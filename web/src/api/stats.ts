import http from './http';

export interface StatsBucket {
  key: string;
  label: string;
  startUtc: string;
}

export interface StatsSeries {
  key: number;
  name: string;
  data: number[];
  total: number;
}

export interface StatsResult {
  meta: {
    granularity: 'day' | 'week' | 'month';
    groupBy: 'category' | 'user';
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
    timezone: string;
  };
  buckets: StatsBucket[];
  series: StatsSeries[];
  pie: { id: number; name: string; value: number }[];
  comparison: { labels: string[]; current: number[]; previous: number[] };
  summary: {
    total: number;
    prevTotal: number;
    growth: number;
    voidTotal: number;
    todayTotal: number;
    activeUsers: number;
  };
}

export interface StatsParams {
  granularity: 'day' | 'week' | 'month';
  group_by: 'category' | 'user';
  from?: string;
  to?: string;
}

export const apiStats = (params: StatsParams) => http.get<StatsResult>('/admin/stats', { params });

/** 导出走浏览器直下，带上 access token 需用 blob 请求 */
export const apiStatsCsv = (params: StatsParams) =>
  http.get<Blob>('/admin/stats/export', { params, responseType: 'blob', timeout: 60000 });
