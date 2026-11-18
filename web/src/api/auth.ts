import http from './http';
import type { AuthUser } from '@/utils/session';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export const apiLogin = (payload: LoginPayload) =>
  http.post<LoginResult>('/auth/login', payload, { silent: true } as any);

export const apiLogout = (refreshToken?: string) =>
  http.post<{ success: boolean }>('/auth/logout', { refreshToken }, { silent: true } as any);

export const apiMe = () => http.get<AuthUser>('/auth/me');

export const apiChangePwd = (payload: { oldPassword: string; newPassword: string }) =>
  http.post<{ success: boolean }>('/auth/change-pwd', payload, { silent: true } as any);
