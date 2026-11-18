import http from './http';
import type { AxiosProgressEvent } from 'axios';

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MiniCategory {
  id: number;
  name: string;
}

export interface MiniUser {
  id: number;
  username: string;
  nickname?: string | null;
}

export interface ImageRecord {
  id: number;
  fileUrl: string;
  fileSize: number;
  fileHash?: string;
  remark?: string | null;
  status: 'normal' | 'void';
  submitTime: string;
  voidTime?: string | null;
  voidReason?: string | null;
  clientType?: 'mobile' | 'pc' | null;
  category?: MiniCategory | null;
  user?: MiniUser | null;
  voider?: { id: number; username: string } | null;
}

export interface UploadResult {
  success: number;
  /** index 指向前端提交时的文件顺序，用于精准标记失败项 */
  failed: { index: number; name: string; reason: string }[];
  records: ImageRecord[];
}

export interface UploadOptions {
  categoryId: number;
  remark?: string;
  clientType: 'mobile' | 'pc';
}

export function uploadImages(
  files: File[],
  opts: UploadOptions,
  onProgress?: (percent: number) => void,
) {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f, f.name));
  fd.append('categoryId', String(opts.categoryId));
  if (opts.remark) fd.append('remark', opts.remark);
  fd.append('clientType', opts.clientType);

  return http.post<UploadResult>('/images', fd, {
    timeout: 120000,
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (!onProgress) return;
      const total = e.total || 0;
      const percent = total > 0 ? Math.round((e.loaded / total) * 100) : Math.min(99, Math.round((e.progress || 0) * 100));
      onProgress(percent);
    },
  });
}

export const apiMyImages = (params: Record<string, any>) =>
  http.get<PageResult<ImageRecord>>('/images/mine', { params });

export const apiVoidOwn = (id: number, reason?: string) =>
  http.post<ImageRecord>(`/images/${id}/void`, { reason });
