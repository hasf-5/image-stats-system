export interface Paginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function parsePagination(query: any, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, parseInt(String(query?.page ?? '1'), 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(String(query?.pageSize ?? defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(list: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { list, total, page, pageSize };
}
