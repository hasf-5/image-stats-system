import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** 后端统一存 UTC，展示统一按上海时区，避免用户设备时区不同导致日期错位 */
export const TZ = 'Asia/Shanghai';

export function fmtDateTime(v?: string | Date | null): string {
  if (!v) return '-';
  return dayjs(v).tz(TZ).format('YYYY-MM-DD HH:mm');
}

export function fmtDate(v?: string | Date | null): string {
  if (!v) return '-';
  return dayjs(v).tz(TZ).format('YYYY-MM-DD');
}

export function fmtTime(v?: string | Date | null): string {
  if (!v) return '-';
  return dayjs(v).tz(TZ).format('HH:mm');
}

export function fmtSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function todayStr(): string {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

export function daysAgoStr(days: number): string {
  return dayjs().tz(TZ).subtract(days, 'day').format('YYYY-MM-DD');
}

/** 简短相对时间，用于「我的记录」卡片 */
export function fromNow(v: string): string {
  const d = dayjs(v).tz(TZ);
  const now = dayjs().tz(TZ);
  const diffMin = now.diff(d, 'minute');
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = now.diff(d, 'hour');
  if (diffH < 24) return `${diffH} 小时前`;
  const diffD = now.diff(d, 'day');
  if (diffD < 7) return `${diffD} 天前`;
  return d.format('MM-DD HH:mm');
}
