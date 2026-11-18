/**
 * 与 server/src/common/utils/time.ts 完全一致的分桶逻辑。
 * 演示模式（GitHub Pages）下没有 MySQL，统计聚合在浏览器里做，
 * 必须保证桶 key / 补零规则与后端一致，否则图表和线上行为会不一致。
 */
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
  startUtc: string;
}

export function todayInAppTz(): string {
  return dayjs().tz(APP_TZ).format('YYYY-MM-DD');
}

export function rangeToUtc(from: string, to: string): { start: Date; end: Date } {
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ).toDate();
  const end = dayjs.tz(`${to} 23:59:59.999`, APP_TZ).toDate();
  return { start, end };
}

export function normalizeRange(from?: string, to?: string, defaultDays = 30) {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  const endStr = from && valid.test(to || '') ? (to as string) : todayInAppTz();
  const startStr =
    from && valid.test(from)
      ? from
      : dayjs.tz(endStr, APP_TZ).subtract(defaultDays - 1, 'day').format('YYYY-MM-DD');
  if (dayjs(startStr).isAfter(dayjs(endStr))) return { from: endStr, to: startStr };
  return { from: startStr, to: endStr };
}

export function buildBuckets(granularity: Granularity, from: string, to: string): Bucket[] {
  const out: Bucket[] = [];
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ);
  const end = dayjs.tz(`${to} 00:00:00`, APP_TZ);

  if (granularity === 'month') {
    let cur = start.startOf('month');
    const last = end.startOf('month');
    while (!cur.isAfter(last)) {
      out.push({ key: cur.format('YYYY-MM'), label: cur.format('YYYY-MM'), startUtc: cur.toDate().toISOString() });
      cur = cur.add(1, 'month');
    }
    return out;
  }

  if (granularity === 'week') {
    let cur = start.startOf('isoWeek');
    const last = end.startOf('isoWeek');
    while (!cur.isAfter(last)) {
      const isoYear = cur.isoWeekYear();
      const week = String(cur.isoWeek()).padStart(2, '0');
      out.push({ key: `${isoYear}${week}`, label: `${isoYear}-W${week}`, startUtc: cur.toDate().toISOString() });
      cur = cur.add(1, 'week');
    }
    return out;
  }

  let cur = start.startOf('day');
  const last = end.startOf('day');
  while (!cur.isAfter(last)) {
    out.push({ key: cur.format('YYYY-MM-DD'), label: cur.format('MM-DD'), startUtc: cur.toDate().toISOString() });
    cur = cur.add(1, 'day');
  }
  return out;
}

export function previousRange(from: string, to: string) {
  const start = dayjs.tz(`${from} 00:00:00`, APP_TZ);
  const end = dayjs.tz(`${to} 00:00:00`, APP_TZ);
  const days = end.diff(start, 'day') + 1;
  const prevEnd = start.subtract(1, 'day');
  const prevStart = prevEnd.subtract(days - 1, 'day');
  return { from: prevStart.format('YYYY-MM-DD'), to: prevEnd.format('YYYY-MM-DD') };
}

/** 某个 UTC 时刻落在哪个桶（与 SQL 的 CONVERT_TZ → DATE_FORMAT 等价） */
export function bucketKeyOf(g: Granularity, d: Date): string {
  const t = dayjs(d).tz(APP_TZ);
  if (g === 'month') return t.format('YYYY-MM');
  if (g === 'week') return `${t.isoWeekYear()}${String(t.isoWeek()).padStart(2, '0')}`;
  return t.format('YYYY-MM-DD');
}

/** 上海时区的当天 yyyy-MM-dd，用于「只能作废当天记录」等判断 */
export function dayOfAppTz(d: Date | string): string {
  return dayjs(d).tz(APP_TZ).format('YYYY-MM-DD');
}
