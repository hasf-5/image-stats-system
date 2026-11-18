import axios, { AxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import { clearSession, loadSession, patchAccessToken } from '@/utils/session';
import { DEMO_MODE } from '@/demo';
import { demoAdapter } from '@/demo/adapter';

export class ApiError extends Error {
  code: number;
  constructor(message: string, code = 0) {
    super(message);
    this.code = code;
  }
}

const service = axios.create({ baseURL: '/api', timeout: 30000 });

// 演示模式（静态托管）下把请求交给浏览器内实现，业务代码零改动
if (DEMO_MODE) service.defaults.adapter = demoAdapter as never;

service.interceptors.request.use((config) => {
  const session = loadSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

/** 用裸 axios 刷新，避免再次进入拦截器造成递归 */
async function doRefresh(): Promise<string | null> {
  const session = loadSession();
  if (!session?.refreshToken) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken: session.refreshToken });
    if (data?.code === 0 && data.data?.accessToken) {
      patchAccessToken(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  clearSession();
  // 演示模式用 hash 路由（静态托管刷新不会 404），跳转方式也不同
  if (DEMO_MODE) {
    if (!location.hash.startsWith('#/login')) location.replace(`${location.pathname}${location.search}#/login`);
    return;
  }
  if (!location.pathname.startsWith('/login')) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login?redirect=${redirect}`);
  }
}

service.interceptors.response.use(
  (res) => {
    const cfg = res.config as any;
    if (cfg.responseType === 'blob') return res.data;

    const body = res.data;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data;
      if (!cfg.silent) ElMessage.error(body.msg || '请求失败');
      return Promise.reject(new ApiError(body.msg || '请求失败', body.code));
    }
    return body;
  },
  async (error) => {
    const cfg: any = error.config || {};
    const status: number | undefined = error.response?.status;
    const body = error.response?.data;
    const msg: string = body?.msg || error.message || '网络异常，请稍后重试';
    const isAuthApi = /\/auth\/(login|refresh)/.test(String(cfg.url || ''));

    // access token 过期 → 静默刷新后重放一次
    if (status === 401 && !isAuthApi && !cfg._retry) {
      cfg._retry = true;
      if (!refreshing) {
        refreshing = doRefresh().finally(() => {
          refreshing = null;
        });
      }
      const token = await refreshing;
      if (token) {
        cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
        return service(cfg);
      }
      redirectToLogin();
      return Promise.reject(new ApiError('登录已失效，请重新登录', 401));
    }

    if (status === 401 && !isAuthApi) redirectToLogin();
    if (!cfg.silent) ElMessage.error(msg);
    return Promise.reject(new ApiError(msg, status || 0));
  },
);

/**
 * 拦截器已把 { code, msg, data } 解包为 data，
 * 这里用自定义类型覆盖 axios 的返回签名，业务层直接拿数据。
 */
type Http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
};

export default service as unknown as Http;
export { service as rawHttp };
