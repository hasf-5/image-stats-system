import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export const APP_TZ = 'Asia/Shanghai';
export type Granularity = 'day' | 'week' | 'month';

export interface Bucket {
  key: string;
  label: string;
  /** 该桶起始时刻（UTC），用于前端 tooltip 与周期对比 */
  startUtc: string;
}

/** 禁止把 dayjs 对象直接暴露给上层，统一输出 ISO 字符串 */
export function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return dayjs(d).toISOString();
}

/** 上海时区的「今天」yyyy-MM-dd */
export function todayInAppTz(): string {
  return dayjs().tz(APP_TZ).format('YYYY-MM-DD');
}

/**
 * 把上海时区的日期区间 [from 00:00, to 23:59:59.999] 转成 UTC 查询区间。
 * from/to 均为 yyyy-MM-dd（含端点）。
 */
export function rangeToUtc(from: string, to: string): { start: Date; end: Date } {
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ).toDate();
  const end = dayjs.tz(`${to} 23:59:59.999`, APP_TZ).toDate();
  return { start, end };
}

export function normalizeRange(from?: string, to?: string, defaultDays = 30) {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  const endStr = from && valid.test(to || '') ? to : todayInAppTz();
  const startStr =
    from && valid.test(from)
      ? from
      : dayjs.tz(endStr, APP_TZ).subtract(defaultDays - 1, 'day').format('YYYY-MM-DD');
  // 防止区间颠倒
  if (dayjs(startStr).isAfter(dayjs(endStr))) return { from: endStr, to: startStr };
  return { from: startStr, to: endStr };
}

/**
 * 生成完整的桶序列（补零的依据）。必须与 SQL 的分组表达式严格一致：
 *  - day   : DATE_FORMAT(CONVERT_TZ(submit_time,'+00:00','+08:00'),'%Y-%m-%d')
 *  - week  : YEARWEEK(CONVERT_TZ(submit_time,'+00:00','+08:00'), 1)  -> YYYYWW
 *  - month : DATE_FORMAT(...,'%Y-%m')
 */
export function buildBuckets(granularity: Granularity, from: string, to: string): Bucket[] {
  const out: Bucket[] = [];
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ);
  const end = dayjs.tz(`${to} 00:00:00`, APP_TZ);

  if (granularity === 'month') {
    let cur = start.startOf('month');
    const last = end.startOf('month');
    while (!cur.isAfter(last)) {
      out.push({
        key: cur.format('YYYY-MM'),
        label: cur.format('YYYY-MM'),
        startUtc: cur.toDate().toISOString(),
      });
      cur = cur.add(1, 'month');
    }
    return out;
  }

  if (granularity === 'week') {
    // 以 ISO 周（周一）为起点对齐
    let cur = start.startOf('isoWeek');
    const last = end.startOf('isoWeek');
    while (!cur.isAfter(last)) {
      const isoYear = cur.isoWeekYear();
      const week = String(cur.isoWeek()).padStart(2, '0');
      out.push({
        key: `${isoYear}${week}`,
        label: `${isoYear}-W${week}`,
        startUtc: cur.toDate().toISOString(),
      });
      cur = cur.add(1, 'week');
    }
    return out;
  }

  let cur = start.startOf('day');
  const last = end.startOf('day');
  while (!cur.isAfter(last)) {
    out.push({
      key: cur.format('YYYY-MM-DD'),
      label: cur.format('MM-DD'),
      startUtc: cur.toDate().toISOString(),
    });
    cur = cur.add(1, 'day');
  }
  return out;
}

/** 与 from/to 等长的上一个区间（用于周期对比柱状图） */
export function previousRange(from: string, to: string) {
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ);
  const end = dayjs.tz(`${to} 00:00:00`, APP_TZ);
  const days = end.diff(start, 'day') + 1;
  const prevEnd = start.subtract(1, 'day');
  const prevStart = prevEnd.subtract(days - 1, 'day');
  return {
    from: prevStart.format('YYYY-MM-DD'),
    to: prevEnd.format('YYYY-MM-DD'),
  };
}
