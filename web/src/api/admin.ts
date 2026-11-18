import http from './http';
import type { ImageRecord, MiniCategory, PageResult } from './images';

export type { PageResult };

export interface CategoryItem extends MiniCategory {
  sort: number;
  status: 'active' | 'disabled';
  imageCount: number;
  createdAt?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  nickname: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  mustChangePwd: boolean;
  createdAt: string;
  createdBy: number | null;
  imageCount: number;
}

/* ---------------- 用户管理 ---------------- */
export const apiAdminUsers = (params: Record<string, any>) =>
  http.get<PageResult<AdminUser>>('/admin/users', { params });

export const apiCreateUser = (body: Record<string, any>) => http.post<AdminUser>('/admin/users', body);

export const apiUpdateUser = (id: number, body: Record<string, any>) =>
  http.put<AdminUser>(`/admin/users/${id}`, body);

export const apiResetPwd = (id: number, newPassword?: string) =>
  http.post<{ username: string; password: string }>(`/admin/users/${id}/reset-pwd`, { newPassword });

export const apiDeleteUser = (id: number) => http.delete<{ success: boolean }>(`/admin/users/${id}`);

/* ---------------- 分类管理 ---------------- */
export const apiCategories = (all = false) =>
  http.get<CategoryItem[]>('/admin/categories', { params: all ? { all: 1 } : {} });

export const apiPublicCategories = () => http.get<MiniCategory[]>('/categories');

export const apiCreateCategory = (body: { name: string; sort?: number }) =>
  http.post<CategoryItem>('/admin/categories', body);

export const apiUpdateCategory = (id: number, body: Record<string, any>) =>
  http.put<CategoryItem>(`/admin/categories/${id}`, body);

export const apiDeleteCategory = (id: number) =>
  http.delete<{ success: boolean }>(`/admin/categories/${id}`);

/* ---------------- 记录管理 ---------------- */
export const apiAdminImages = (params: Record<string, any>) =>
  http.get<PageResult<ImageRecord>>('/admin/images', { params });

export const apiAdminVoid = (id: number, reason?: string) =>
  http.post<ImageRecord>(`/admin/images/${id}/void`, { reason });

export const apiAdminRestore = (id: number) =>
  http.post<ImageRecord>(`/admin/images/${id}/restore`, {});

/* ---------------- 报表配置 ---------------- */
export interface ReportConfig {
  id: number;
  name: string;
  granularity: 'day' | 'week' | 'month';
  group_by: 'category' | 'user';
  date_start?: string | null;
  date_end?: string | null;
  createdAt?: string;
}

export const apiReports = () => http.get<ReportConfig[]>('/admin/reports');

export const apiCreateReport = (body: Record<string, any>) =>
  http.post<ReportConfig>('/admin/reports', body);

export const apiUpdateReport = (id: number, body: Record<string, any>) =>
  http.put<ReportConfig>(`/admin/reports/${id}`, body);

export const apiDeleteReport = (id: number) =>
  http.delete<{ success: boolean }>(`/admin/reports/${id}`);

/* ---------------- 审计日志 ---------------- */
export interface AuditLog {
  id: number;
  action: string;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
  user: { id: number; username: string; nickname: string | null } | null;
}

export const apiAuditLogs = (params: Record<string, any>) =>
  http.get<PageResult<AuditLog>>('/admin/audit-logs', { params });
