import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  Bucket,
  buildBuckets,
  Granularity,
  normalizeRange,
  previousRange,
  rangeToUtc,
} from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.module';

export interface StatsQuery {
  granularity?: Granularity | string;
  group_by?: 'category' | 'user' | string;
  from?: string;
  to?: string;
}

interface Row {
  bucket: string;
  gid: number;
  cnt: bigint | number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * MySQL 侧统一把 UTC 的 submit_time 转成上海本地时间再分桶，
   * 与 buildBuckets() 的 key 规则严格一致，否则前端补零会错位。
   */
  private bucketExpr(g: Granularity) {
    const local = "CONVERT_TZ(submit_time,'+00:00','+08:00')";
    if (g === 'week') return Prisma.raw(`CAST(YEARWEEK(${local}, 1) AS CHAR)`);
    if (g === 'month') return Prisma.raw(`DATE_FORMAT(${local}, '%Y-%m')`);
    return Prisma.raw(`DATE_FORMAT(${local}, '%Y-%m-%d')`);
  }

  private async aggregate(g: Granularity, start: Date, end: Date, groupBy: 'category' | 'user'): Promise<Row[]> {
    const dim = Prisma.raw(groupBy === 'user' ? 'user_id' : 'category_id');
    const b = this.bucketExpr(g);
    return this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${b} AS bucket, ${dim} AS gid, COUNT(*) AS cnt
      FROM image_record
      WHERE status = 'normal' AND submit_time >= ${start} AND submit_time <= ${end}
      GROUP BY bucket, gid
    `);
  }

  /** 键值补齐：缺失的桶返回 0，避免折线断点 */
  private fill(buckets: Bucket[], rows: Row[], gid: number): number[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (Number(r.gid) !== gid) continue;
      map.set(String(r.bucket), Number(r.cnt));
    }
    return buckets.map((b) => map.get(b.key) ?? 0);
  }

  async query(q: StatsQuery) {
    const granularity: Granularity =
      q.granularity === 'week' || q.granularity === 'month' ? q.granularity : 'day';
    const groupBy: 'category' | 'user' = q.group_by === 'user' ? 'user' : 'category';
    const { from, to } = normalizeRange(q.from, q.to, 30);

    const buckets = buildBuckets(granularity, from, to);
    const { start, end } = rangeToUtc(from, to);
    const prev = previousRange(from, to);
    const prevUtc = rangeToUtc(prev.from, prev.to);

    // 1) 趋势聚合（按所选维度）
    const rows = await this.aggregate(granularity, start, end, groupBy);

    // 2) 分类占比固定按分类统计
    const pieRows = await this.aggregate(granularity, start, end, 'category');

    // 3) 上一周期（等长）用于柱状对比
    const prevBuckets = buildBuckets(granularity, prev.from, prev.to);
    const prevRows = await this.aggregate(granularity, prevUtc.start, prevUtc.end, groupBy);

    // 维度名称
    const [categories, users] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
      this.prisma.user.findMany({ select: { id: true, username: true, nickname: true } }),
    ]);
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const userMap = new Map(users.map((u) => [u.id, u.nickname || u.username]));

    const gids = Array.from(new Set(rows.map((r) => Number(r.gid)))).sort((a, b) => a - b);
    const series = gids.map((gid) => ({
      key: gid,
      name:
        groupBy === 'category'
          ? catMap.get(gid) || `已删除分类 #${gid}`
          : userMap.get(gid) || `已删除用户 #${gid}`,
      data: this.fill(buckets, rows, gid),
      total: rows.filter((r) => Number(r.gid) === gid).reduce((s, r) => s + Number(r.cnt), 0),
    }));
    series.sort((a, b) => b.total - a.total);

    // 分类占比（环形）
    const pieMap = new Map<number, number>();
    for (const r of pieRows) {
      const gid = Number(r.gid);
      pieMap.set(gid, (pieMap.get(gid) || 0) + Number(r.cnt));
    }
    const pie = Array.from(pieMap.entries())
      .map(([gid, value]) => ({ id: gid, name: catMap.get(gid) || `已删除分类 #${gid}`, value }))
      .sort((a, b) => b.value - a.value);

    // 周期对比：按「第 N 个桶」对齐当前区间与上一区间（天数不同时以短边为准补 0）
    const currentTotals = buckets.map((_, i) => series.reduce((s, se) => s + (se.data[i] || 0), 0));
    const prevMap = new Map<string, number>();
    for (const r of prevRows) {
      const k = String(r.bucket);
      prevMap.set(k, (prevMap.get(k) || 0) + Number(r.cnt));
    }
    const prevTotals = buckets.map((_, i) => {
      const pb = prevBuckets[i];
      return pb ? prevMap.get(pb.key) ?? 0 : 0;
    });

    // 概览指标
    const total = currentTotals.reduce((a, b) => a + b, 0);
    const prevTotal = prevTotals.reduce((a, b) => a + b, 0);
    const [voidTotal, todayTotal, activeUsers] = await Promise.all([
      this.prisma.imageRecord.count({ where: { status: 'void', submitTime: { gte: start, lte: end } } }),
      this.prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS c FROM image_record
        WHERE status='normal' AND DATE(CONVERT_TZ(submit_time,'+00:00','+08:00')) = DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00'))
      `),
      this.prisma.imageRecord.findMany({
        where: { status: 'normal', submitTime: { gte: start, lte: end } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    return {
      meta: { granularity, groupBy, from, to, prevFrom: prev.from, prevTo: prev.to, timezone: 'Asia/Shanghai' },
      buckets: buckets.map((b) => ({ key: b.key, label: b.label, startUtc: b.startUtc })),
      series,
      pie,
      comparison: {
        labels: buckets.map((b) => b.label),
        current: currentTotals,
        previous: prevTotals,
      },
      summary: {
        total,
        prevTotal,
        growth: prevTotal === 0 ? (total > 0 ? 100 : 0) : Number((((total - prevTotal) / prevTotal) * 100).toFixed(1)),
        voidTotal,
        todayTotal: Number(todayTotal?.[0]?.c ?? 0),
        activeUsers: activeUsers.length,
      },
    };
  }

  /** 导出统计汇总 CSV（带 BOM，Excel 打开中文不乱码） */
  async exportCsv(q: StatsQuery): Promise<{ filename: string; content: string }> {
    const data = await this.query(q);
    const head = ['时间桶', '时间标签', data.meta.groupBy === 'user' ? '用户' : '分类', '数量'];
    const lines: string[] = [head.join(',')];

    for (const s of data.series) {
      data.buckets.forEach((b, i) => {
        lines.push([b.key, b.label, s.name, String(s.data[i] ?? 0)].map(csvCell).join(','));
      });
    }
    lines.push('');
    lines.push(['分类占比汇总', '', '数量'].map(csvCell).join(','));
    for (const p of data.pie) lines.push([p.name, '', String(p.value)].map(csvCell).join(','));
    lines.push('');
    lines.push(['区间合计', '', String(data.summary.total)].map(csvCell).join(','));

    const filename = `stats_${data.meta.granularity}_${data.meta.groupBy}_${data.meta.from}_${data.meta.to}.csv`;
    return { filename, content: '\uFEFF' + lines.join('\r\n') };
  }
}

function csvCell(v: string) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
