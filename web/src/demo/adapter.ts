/**
 * 演示模式的「假后端」：以 axios adapter 的形式挂在 axios 上。
 *
 * 为什么用 adapter 而不是改 views：
 *  业务代码（api/*.ts、各页面）完全不用改，契约、错误码、分页结构都与
 *  NestJS 后端保持一致；切回真后端只要不开启演示模式即可。
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { APP_TZ, buildBuckets, bucketKeyOf, dayOfAppTz, Granularity, normalizeRange, previousRange, rangeToUtc, todayInAppTz } from './time';
import { current, getState, mutate, nextId, type DemoRecord, type DemoUser, type Role } from './store';

const ACCESS_TTL = 15 * 60 * 1000; // 与后端一致：15 分钟
const REFRESH_TTL = 7 * 24 * 3600 * 1000;
const MAX_FAIL = 5;
const LOCK_MS = 10 * 60 * 1000;

interface TokenPayload {
  sub: number;
  username: string;
  role: Role;
  nickname: string | null;
  typ: 'access' | 'refresh';
  jti: string;
  exp: number;
}

/* ---------------- 工具 ---------------- */

const enc = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const dec = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sign(payload: TokenPayload): string {
  return `demo.${enc(JSON.stringify(payload))}.${enc('demo-signature')}`;
}

function readToken(token?: string | null): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(dec(parts[1])) as TokenPayload;
  } catch {
    return null;
  }
}

function issueTokens(user: DemoUser) {
  const now = Date.now();
  const base = { sub: user.id, username: user.username, role: user.role, nickname: user.nickname };
  return {
    accessToken: sign({ ...base, typ: 'access', jti: uuid(), exp: now + ACCESS_TTL }),
    refreshToken: sign({ ...base, typ: 'refresh', jti: uuid(), exp: now + REFRESH_TTL }),
    expiresIn: ACCESS_TTL / 1000,
  };
}

function profile(u: DemoUser) {
  return { id: u.id, username: u.username, nickname: u.nickname, role: u.role, mustChangePwd: u.mustChangePwd };
}

class DemoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const bad = (msg: string) => new DemoError(400, msg);
const unauthorized = (msg = '登录已失效，请重新登录') => new DemoError(401, msg);
const forbidden = (msg: string) => new DemoError(403, msg);
const notFound = (msg: string) => new DemoError(404, msg);
const conflict = (msg: string) => new DemoError(409, msg);

function ok(config: AxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config: config as never };
}

function toAxiosError(config: AxiosRequestConfig, err: DemoError) {
  const res = {
    data: { code: err.status === 401 ? 401 : err.status, msg: err.message, data: null },
    status: err.status,
    statusText: 'ERROR',
    headers: {},
    config,
  };
  const e: any = new Error(err.message);
  e.isAxiosError = true;
  e.config = config;
  e.response = res;
  e.status = err.status;
  return e;
}

function body(config: AxiosRequestConfig): any {
  const d = config.data;
  if (!d) return {};
  if (typeof d === 'string') {
    try {
      return JSON.parse(d);
    } catch {
      return {};
    }
  }
  if (typeof FormData !== 'undefined' && d instanceof FormData) return d;
  return d;
}

function q(config: AxiosRequestConfig): Record<string, any> {
  const p = (config.params || {}) as Record<string, any>;
  const out: Record<string, any> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

function pagination(query: Record<string, any>, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(String(query.pageSize || defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function authHeader(config: AxiosRequestConfig): TokenPayload {
  const h: any = config.headers || {};
  const raw = h.Authorization || h.authorization || (typeof h.get === 'function' ? h.get('Authorization') : undefined);
  const token = String(raw || '').replace(/^Bearer\s+/i, '');
  const payload = readToken(token);
  if (!payload) throw unauthorized();
  if (payload.typ !== 'access') throw unauthorized();
  if (payload.exp < Date.now()) throw unauthorized();
  const s = current();
  if (s.blacklist[payload.jti]) throw unauthorized();
  const user = s.users.find((u) => u.id === payload.sub);
  if (!user) throw unauthorized();
  if (user.status === 'disabled') throw unauthorized('账号已被禁用，请联系管理员');
  return payload;
}

function requireAdmin(config: AxiosRequestConfig): TokenPayload {
  const p = authHeader(config);
  if (p.role !== 'admin') throw forbidden('无权访问');
  return p;
}

function shapeRecord(r: DemoRecord) {
  const s = current();
  const cat = s.categories.find((c) => c.id === r.categoryId) || null;
  const user = s.users.find((u) => u.id === r.userId) || null;
  const voider = r.voidBy ? s.users.find((u) => u.id === r.voidBy) || null : null;
  return {
    id: r.id,
    fileUrl: s.images[r.img] || '',
    fileSize: r.fileSize,
    fileHash: r.fileHash,
    remark: r.remark,
    status: r.status,
    submitTime: r.submitTime,
    voidTime: r.voidTime,
    voidReason: r.voidReason,
    clientType: r.clientType,
    category: cat ? { id: cat.id, name: cat.name } : null,
    user: user ? { id: user.id, username: user.username, nickname: user.nickname } : null,
    voider: voider ? { id: voider.id, username: voider.username } : null,
  };
}

function audit(userId: number | null, action: string, targetId: string | number | null) {
  mutate((s) => {
    s.audits.unshift({
      id: nextId('audit'),
      userId,
      action,
      targetId: targetId === null ? null : String(targetId),
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
    });
    if (s.audits.length > 500) s.audits.length = 500;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 业务处理 ---------------- */

async function handle(config: AxiosRequestConfig, method: string, path: string): Promise<AxiosResponse> {
  const s = await getState();
  const query = q(config);
  const payload = body(config);

  /* ===== 认证 ===== */
  if (method === 'POST' && path === '/auth/login') {
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '');
    if (!username || !password) throw bad('请输入账号和密码');

    const lockedUntil = s.locks[username] || 0;
    if (lockedUntil > Date.now()) throw new DemoError(429, `登录失败次数过多，请 ${Math.ceil((lockedUntil - Date.now()) / 60000)} 分钟后再试`);

    const user = s.users.find((u) => u.username === username);
    const matched = !!user && user.password === password;

    if (!user || !matched) {
      const rec = s.fails[username] || { count: 0, resetAt: Date.now() + LOCK_MS };
      if (rec.resetAt < Date.now()) {
        rec.count = 0;
        rec.resetAt = Date.now() + LOCK_MS;
      }
      rec.count += 1;
      mutate((st) => {
        st.fails[username] = rec;
        if (rec.count >= MAX_FAIL) {
          st.locks[username] = Date.now() + LOCK_MS;
          delete st.fails[username];
        }
      });
      if (rec.count >= MAX_FAIL) throw new DemoError(429, `登录失败次数过多，请 ${Math.ceil(LOCK_MS / 60000)} 分钟后再试`);
      throw unauthorized('账号或密码错误');
    }

    if (user.status === 'disabled') throw forbidden('账号已被禁用，请联系管理员');

    mutate((st) => {
      delete st.fails[username];
    });
    audit(user.id, 'login', null);
    return ok(config, { ...issueTokens(user), user: profile(user) });
  }

  if (method === 'POST' && path === '/auth/refresh') {
    const t = readToken(String(payload.refreshToken || ''));
    if (!t || t.typ !== 'refresh' || t.exp < Date.now()) throw unauthorized();
    if (s.blacklist[t.jti]) throw unauthorized();
    const user = s.users.find((u) => u.id === t.sub);
    if (!user) throw unauthorized();
    if (user.status === 'disabled') throw unauthorized('账号已被禁用，请联系管理员');
    // 轮换：旧 refresh 立即失效
    mutate((st) => {
      st.blacklist[t.jti] = Math.floor(t.exp / 1000);
    });
    return ok(config, issueTokens(user));
  }

  if (method === 'POST' && path === '/auth/logout') {
    const p = authHeader(config);
    mutate((st) => {
      st.blacklist[p.jti] = Math.floor(p.exp / 1000);
    });
    const rt = readToken(String(payload.refreshToken || ''));
    if (rt) {
      mutate((st) => {
        st.blacklist[rt.jti] = Math.floor(rt.exp / 1000);
      });
    }
    audit(p.sub, 'logout', null);
    return ok(config, { success: true });
  }

  if (method === 'GET' && path === '/auth/me') {
    const p = authHeader(config);
    const user = current().users.find((u) => u.id === p.sub)!;
    return ok(config, profile(user));
  }

  if (method === 'POST' && path === '/auth/change-pwd') {
    const p = authHeader(config);
    const user = current().users.find((u) => u.id === p.sub)!;
    if (String(payload.oldPassword || '') !== user.password) throw bad('原密码不正确');
    if (String(payload.newPassword || '') === user.password) throw bad('新密码不能与原密码相同');
    if (!/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/.test(String(payload.newPassword || ''))) {
      throw bad('密码需 8-32 位，且同时包含字母和数字');
    }
    mutate(() => {
      user.password = String(payload.newPassword);
      user.mustChangePwd = false;
    });
    mutate((st) => {
      st.blacklist[p.jti] = Math.floor(p.exp / 1000);
    });
    audit(p.sub, 'change_pwd', null);
    return ok(config, { success: true });
  }

  /* ===== 公共分类 ===== */
  if (method === 'GET' && path === '/categories') {
    const list = s.categories
      .filter((c) => c.status === 'active')
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((c) => ({ id: c.id, name: c.name }));
    return ok(config, list);
  }

  /* ===== 用户端：上传 / 我的记录 / 作废 ===== */
  if (method === 'POST' && path === '/images') {
    const p = authHeader(config);
    if (!(payload instanceof FormData)) throw bad('请至少选择一张图片');
    const files = payload.getAll('files').filter((f) => f instanceof Blob) as File[];
    if (!files.length) throw bad('请至少选择一张图片');

    const categoryId = Number(payload.get('categoryId') || 0);
    const cat = s.categories.find((c) => c.id === categoryId);
    if (!cat || cat.status !== 'active') throw bad('分类不存在或已停用');
    const remarkRaw = payload.get('remark');
    const remark = remarkRaw ? String(remarkRaw).trim().slice(0, 255) : null;
    const clientType = payload.get('clientType') === 'mobile' ? 'mobile' : payload.get('clientType') === 'pc' ? 'pc' : null;

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
    let loadedBytes = 0;
    const created: any[] = [];
    const failed: { index: number; name: string; reason: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const name = f.name || `image-${i + 1}`;
      if (!f.size) {
        failed.push({ index: i, name, reason: '空文件' });
        continue;
      }
      if (!/^image\//.test(f.type || '')) {
        failed.push({ index: i, name, reason: '文件内容不是有效图片' });
        continue;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read error'));
        reader.readAsDataURL(f);
      }).catch(() => '');

      loadedBytes += f.size;
      config.onUploadProgress?.({ loaded: loadedBytes, total: totalBytes, progress: loadedBytes / totalBytes, bytes: f.size, lengthComputable: true } as never);

      if (!dataUrl) {
        failed.push({ index: i, name, reason: '文件内容不是有效图片' });
        continue;
      }

      const imgKey = `up${Date.now()}-${i}`;
      const record: DemoRecord = {
        id: 0,
        userId: p.sub,
        categoryId,
        img: imgKey,
        fileSize: f.size,
        fileHash: `sha-${Date.now()}-${i}`,
        remark,
        status: 'normal',
        submitTime: new Date().toISOString(),
        voidBy: null,
        voidTime: null,
        voidReason: null,
        clientType,
      };
      mutate((st) => {
        st.images[imgKey] = dataUrl;
        record.id = nextId('record');
        st.records.push(record);
      });
      created.push(shapeRecord(record));
    }

    if (!created.length) throw bad(failed[0]?.reason || '上传失败，请检查图片格式');
    audit(p.sub, 'image_upload', `count:${created.length}`);
    return ok(config, { success: created.length, failed, records: created });
  }

  if (method === 'GET' && path === '/images/mine') {
    const p = authHeader(config);
    const { page, pageSize, skip, take } = pagination(query);
    let rows = s.records.filter((r) => r.userId === p.sub);
    rows = applyFilters(rows, query);
    rows.sort((a, b) => b.submitTime.localeCompare(a.submitTime));
    return ok(config, {
      list: rows.slice(skip, skip + take).map(shapeRecord),
      total: rows.length,
      page,
      pageSize,
    });
  }

  const ownVoid = path.match(/^\/images\/(\d+)\/void$/);
  if (method === 'POST' && ownVoid) {
    const p = authHeader(config);
    const id = Number(ownVoid[1]);
    const rec = s.records.find((r) => r.id === id);
    if (!rec) throw notFound('记录不存在');
    if (rec.userId !== p.sub) throw forbidden('只能作废自己的记录');
    if (rec.status === 'void') throw bad('该记录已作废');
    if (dayOfAppTz(rec.submitTime) !== todayInAppTz()) throw forbidden('只能作废当天的记录，更早的记录请联系管理员');
    mutate(() => {
      rec.status = 'void';
      rec.voidBy = p.sub;
      rec.voidTime = new Date().toISOString();
      rec.voidReason = String(payload.reason || '').trim() || '本人作废';
    });
    audit(p.sub, 'image_void', id);
    return ok(config, shapeRecord(rec));
  }

  /* ===== 管理端：用户 ===== */
  if (method === 'GET' && path === '/admin/users') {
    requireAdmin(config);
    const { page, pageSize, skip, take } = pagination(query);
    let rows = [...s.users];
    if (query.keyword) {
      const kw = String(query.keyword).trim().toLowerCase();
      rows = rows.filter((u) => u.username.toLowerCase().includes(kw) || (u.nickname || '').toLowerCase().includes(kw));
    }
    if (query.role && ['admin', 'user'].includes(String(query.role))) rows = rows.filter((u) => u.role === query.role);
    if (query.status && ['active', 'disabled'].includes(String(query.status))) rows = rows.filter((u) => u.status === query.status);
    rows.sort((a, b) => (a.role === b.role ? b.id - a.id : a.role === 'admin' ? -1 : 1));
    const list = rows.slice(skip, skip + take).map((u) => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      role: u.role,
      status: u.status,
      mustChangePwd: u.mustChangePwd,
      createdAt: u.createdAt,
      createdBy: u.createdBy,
      imageCount: s.records.filter((r) => r.userId === u.id).length,
    }));
    return ok(config, { list, total: rows.length, page, pageSize });
  }

  if (method === 'POST' && path === '/admin/users') {
    const p = requireAdmin(config);
    const username = String(payload.username || '').trim();
    if (!/^[a-zA-Z0-9_.-]{2,50}$/.test(username)) throw bad('账号长度需为 2-50 位，且只能包含字母、数字、下划线、点和短横线');
    if (!/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/.test(String(payload.password || ''))) throw bad('密码需 8-32 位，且同时包含字母和数字');
    if (s.users.some((u) => u.username === username)) throw conflict('该账号已存在');

    const user: DemoUser = {
      id: 0,
      username,
      password: String(payload.password),
      nickname: String(payload.nickname || '').trim() || username,
      role: payload.role === 'admin' ? 'admin' : 'user',
      status: payload.status === 'disabled' ? 'disabled' : 'active',
      mustChangePwd: true,
      createdAt: new Date().toISOString(),
      createdBy: p.sub,
    };
    mutate((st) => {
      user.id = nextId('user');
      st.users.push(user);
    });
    audit(p.sub, 'user_create', user.id);
    return ok(config, { ...profile(user), status: user.status, createdAt: user.createdAt, createdBy: user.createdBy });
  }

  const userRoute = path.match(/^\/admin\/users\/(\d+)$/);
  if (userRoute && method === 'PUT') {
    const p = requireAdmin(config);
    const target = s.users.find((u) => u.id === Number(userRoute[1]));
    if (!target) throw notFound('用户不存在');
    if (target.id === p.sub) {
      if (payload.role && payload.role !== 'admin') throw bad('不能修改自己的管理员角色');
      if (payload.status && payload.status !== 'active') throw bad('不能禁用自己的账号');
    }
    const nextRole = payload.role === undefined ? target.role : payload.role === 'admin' ? 'admin' : 'user';
    const nextStatus = payload.status === undefined ? target.status : payload.status === 'disabled' ? 'disabled' : 'active';
    if (target.role === 'admin' && (nextRole === 'user' || nextStatus === 'disabled')) {
      const otherAdmins = s.users.filter((u) => u.role === 'admin' && u.status === 'active' && u.id !== target.id).length;
      if (!otherAdmins) throw bad('系统至少需要保留一个启用的管理员');
    }
    mutate(() => {
      if (payload.nickname !== undefined) target.nickname = String(payload.nickname).trim() || target.username;
      target.role = nextRole as Role;
      target.status = nextStatus;
    });
    audit(p.sub, 'user_update', target.id);
    return ok(config, { ...profile(target), status: target.status, createdAt: target.createdAt, createdBy: target.createdBy });
  }

  if (userRoute && method === 'DELETE') {
    const p = requireAdmin(config);
    const id = Number(userRoute[1]);
    const target = s.users.find((u) => u.id === id);
    if (!target) throw notFound('用户不存在');
    if (target.id === p.sub) throw bad('不能删除自己的账号');
    if (target.role === 'admin') {
      const otherAdmins = s.users.filter((u) => u.role === 'admin' && u.status === 'active' && u.id !== id).length;
      if (!otherAdmins) throw bad('系统至少需要保留一个启用的管理员');
    }
    const count = s.records.filter((r) => r.userId === id).length;
    if (count > 0) throw forbidden(`该用户已有 ${count} 条图片记录，为保证统计可追溯只能禁用，不能删除`);
    mutate((st) => {
      st.users = st.users.filter((u) => u.id !== id);
      st.audits.forEach((a) => {
        if (a.userId === id) a.userId = null;
      });
    });
    audit(p.sub, 'user_delete', id);
    return ok(config, { success: true });
  }

  const resetRoute = path.match(/^\/admin\/users\/(\d+)\/reset-pwd$/);
  if (resetRoute && method === 'POST') {
    const p = requireAdmin(config);
    const target = s.users.find((u) => u.id === Number(resetRoute[1]));
    if (!target) throw notFound('用户不存在');
    let plain = String(payload.newPassword || '');
    if (plain) {
      if (!/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/.test(plain)) throw bad('密码需 8-32 位，且同时包含字母和数字');
    } else {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      plain = 'Aa1';
      for (let i = 0; i < 9; i++) plain += chars[Math.floor(Math.random() * chars.length)];
    }
    mutate(() => {
      target.password = plain;
      target.mustChangePwd = true;
    });
    audit(p.sub, 'user_reset_pwd', target.id);
    return ok(config, { username: target.username, password: plain });
  }

  /* ===== 管理端：分类 ===== */
  if (method === 'GET' && path === '/admin/categories') {
    requireAdmin(config);
    const onlyActive = String(query.all || '') !== '1';
    const list = s.categories
      .filter((c) => (onlyActive ? c.status === 'active' : true))
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sort: c.sort,
        status: c.status,
        createdAt: c.createdAt,
        imageCount: s.records.filter((r) => r.categoryId === c.id).length,
      }));
    return ok(config, list);
  }

  if (method === 'POST' && path === '/admin/categories') {
    const p = requireAdmin(config);
    const name = String(payload.name || '').trim();
    if (!name) throw bad('请输入分类名称');
    if (s.categories.some((c) => c.name === name)) throw conflict('分类名称已存在');
    const cat = { id: 0, name, sort: Number(payload.sort ?? 0) || 0, status: 'active' as const, createdAt: new Date().toISOString() };
    mutate((st) => {
      cat.id = nextId('category');
      st.categories.push(cat);
    });
    audit(p.sub, 'category_create', cat.id);
    return ok(config, cat);
  }

  const catRoute = path.match(/^\/admin\/categories\/(\d+)$/);
  if (catRoute && method === 'PUT') {
    const p = requireAdmin(config);
    const cat = s.categories.find((c) => c.id === Number(catRoute[1]));
    if (!cat) throw notFound('分类不存在');
    const name = payload.name === undefined ? cat.name : String(payload.name).trim();
    if (name !== cat.name && s.categories.some((c) => c.name === name)) throw conflict('分类名称已存在');
    mutate(() => {
      cat.name = name;
      if (payload.sort !== undefined) cat.sort = Number(payload.sort) || 0;
      if (payload.status !== undefined) cat.status = payload.status === 'disabled' ? 'disabled' : 'active';
    });
    audit(p.sub, 'category_update', cat.id);
    return ok(config, cat);
  }

  if (catRoute && method === 'DELETE') {
    const p = requireAdmin(config);
    const id = Number(catRoute[1]);
    const cat = s.categories.find((c) => c.id === id);
    if (!cat) throw notFound('分类不存在');
    const count = s.records.filter((r) => r.categoryId === id).length;
    if (count > 0) throw bad(`该分类下已有 ${count} 条图片记录，不能删除；请改为「禁用」以停止使用`);
    mutate((st) => {
      st.categories = st.categories.filter((c) => c.id !== id);
    });
    audit(p.sub, 'category_delete', id);
    return ok(config, { success: true });
  }

  /* ===== 管理端：图片记录 ===== */
  if (method === 'GET' && path === '/admin/images') {
    requireAdmin(config);
    const { page, pageSize, skip, take } = pagination(query);
    const rows = applyFilters(s.records, query).sort((a, b) => b.submitTime.localeCompare(a.submitTime));
    return ok(config, {
      list: rows.slice(skip, skip + take).map(shapeRecord),
      total: rows.length,
      page,
      pageSize,
    });
  }

  const adminVoid = path.match(/^\/admin\/images\/(\d+)\/void$/);
  if (adminVoid && method === 'POST') {
    const p = requireAdmin(config);
    const rec = s.records.find((r) => r.id === Number(adminVoid[1]));
    if (!rec) throw notFound('记录不存在');
    if (rec.status === 'void') throw bad('该记录已作废');
    mutate(() => {
      rec.status = 'void';
      rec.voidBy = p.sub;
      rec.voidTime = new Date().toISOString();
      rec.voidReason = String(payload.reason || '').trim() || '管理员作废';
    });
    audit(p.sub, 'image_void', rec.id);
    return ok(config, shapeRecord(rec));
  }

  const adminRestore = path.match(/^\/admin\/images\/(\d+)\/restore$/);
  if (adminRestore && method === 'POST') {
    const p = requireAdmin(config);
    const rec = s.records.find((r) => r.id === Number(adminRestore[1]));
    if (!rec) throw notFound('记录不存在');
    if (rec.status === 'normal') throw bad('该记录未作废');
    mutate(() => {
      rec.status = 'normal';
      rec.voidBy = null;
      rec.voidTime = null;
      rec.voidReason = null;
    });
    audit(p.sub, 'image_void', `restore:${rec.id}`);
    return ok(config, shapeRecord(rec));
  }

  /* ===== 管理端：统计 ===== */
  if (method === 'GET' && path === '/admin/stats') {
    requireAdmin(config);
    return ok(config, buildStats(query));
  }

  if (method === 'GET' && path === '/admin/stats/export') {
    requireAdmin(config);
    const data = buildStats(query);
    const head = ['时间桶', '时间标签', data.meta.groupBy === 'user' ? '用户' : '分类', '数量'];
    const lines: string[] = [head.join(',')];
    data.series.forEach((se) => {
      data.buckets.forEach((b, i) => {
        lines.push([b.key, b.label, se.name, String(se.data[i] ?? 0)].map(csvCell).join(','));
      });
    });
    lines.push('');
    lines.push(['分类占比汇总', '', '数量'].map(csvCell).join(','));
    data.pie.forEach((pi) => lines.push([pi.name, '', String(pi.value)].map(csvCell).join(',')));
    lines.push('');
    lines.push(['区间合计', '', String(data.summary.total)].map(csvCell).join(','));
    const csv = '\uFEFF' + lines.join('\r\n');
    return ok(config, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  }

  /* ===== 管理端：报表配置 ===== */
  if (method === 'GET' && path === '/admin/reports') {
    requireAdmin(config);
    const list = [...s.reports]
      .sort((a, b) => b.id - a.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        granularity: r.granularity,
        group_by: r.groupBy,
        date_start: r.dateStart,
        date_end: r.dateEnd,
        createdAt: r.createdAt,
      }));
    return ok(config, list);
  }

  if (method === 'POST' && path === '/admin/reports') {
    const p = requireAdmin(config);
    const name = String(payload.name || '').trim();
    if (!name) throw bad('请输入配置名称');
    const report = {
      id: 0,
      name,
      granularity: (payload.granularity || 'day') as 'day' | 'week' | 'month',
      groupBy: (payload.group_by || 'category') as 'category' | 'user',
      dateStart: payload.date_start || null,
      dateEnd: payload.date_end || null,
      createdBy: p.sub,
      createdAt: new Date().toISOString(),
    };
    mutate((st) => {
      report.id = nextId('report');
      st.reports.push(report);
    });
    audit(p.sub, 'report_create', report.id);
    return ok(config, { ...report, group_by: report.groupBy, date_start: report.dateStart, date_end: report.dateEnd });
  }

  const reportRoute = path.match(/^\/admin\/reports\/(\d+)$/);
  if (reportRoute && method === 'PUT') {
    const p = requireAdmin(config);
    const rep = s.reports.find((r) => r.id === Number(reportRoute[1]));
    if (!rep) throw notFound('配置不存在');
    mutate(() => {
      if (payload.name !== undefined) rep.name = String(payload.name).trim();
      if (payload.granularity !== undefined) rep.granularity = payload.granularity;
      if (payload.group_by !== undefined) rep.groupBy = payload.group_by;
      if (payload.date_start !== undefined) rep.dateStart = payload.date_start || null;
      if (payload.date_end !== undefined) rep.dateEnd = payload.date_end || null;
    });
    audit(p.sub, 'report_update', rep.id);
    return ok(config, { ...rep, group_by: rep.groupBy, date_start: rep.dateStart, date_end: rep.dateEnd });
  }

  if (reportRoute && method === 'DELETE') {
    const p = requireAdmin(config);
    const id = Number(reportRoute[1]);
    mutate((st) => {
      st.reports = st.reports.filter((r) => r.id !== id);
    });
    audit(p.sub, 'report_delete', id);
    return ok(config, { success: true });
  }

  /* ===== 管理端：审计日志 ===== */
  if (method === 'GET' && path === '/admin/audit-logs') {
    requireAdmin(config);
    const { page, pageSize, skip, take } = pagination(query);
    const list = s.audits.slice(skip, skip + take).map((a) => {
      const u = a.userId ? s.users.find((x) => x.id === a.userId) : null;
      return {
        id: a.id,
        action: a.action,
        targetId: a.targetId,
        ip: a.ip,
        createdAt: a.createdAt,
        user: u ? { id: u.id, username: u.username, nickname: u.nickname } : null,
      };
    });
    return ok(config, { list, total: s.audits.length, page, pageSize });
  }

  throw notFound(`接口未实现：${method} ${path}`);
}

function applyFilters(rows: DemoRecord[], query: Record<string, any>): DemoRecord[] {
  let out = rows;
  if (query.categoryId) out = out.filter((r) => r.categoryId === Number(query.categoryId));
  if (query.userId) out = out.filter((r) => r.userId === Number(query.userId));
  if (query.status && ['normal', 'void'].includes(String(query.status))) out = out.filter((r) => r.status === query.status);
  if (query.keyword) {
    const kw = String(query.keyword).trim().toLowerCase();
    out = out.filter((r) => (r.remark || '').toLowerCase().includes(kw));
  }
  if (query.from || query.to) {
    const { from, to } = normalizeRange(query.from, query.to, 30);
    const { start, end } = rangeToUtc(from, to);
    out = out.filter((r) => {
      const t = new Date(r.submitTime).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }
  return out;
}

function csvCell(v: string) {
  const str = String(v ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** 与后端 StatsService 对齐的聚合实现 */
function buildStats(query: Record<string, any>) {
  const s = current();
  const granularity: Granularity = query.granularity === 'week' || query.granularity === 'month' ? query.granularity : 'day';
  const groupBy: 'category' | 'user' = query.group_by === 'user' ? 'user' : 'category';
  const { from, to } = normalizeRange(query.from, query.to, 30);
  const buckets = buildBuckets(granularity, from, to);
  const { start, end } = rangeToUtc(from, to);
  const prev = previousRange(from, to);
  const prevUtc = rangeToUtc(prev.from, prev.to);

  const inRange = (r: DemoRecord, a: Date, b: Date) => {
    const t = new Date(r.submitTime).getTime();
    return t >= a.getTime() && t <= b.getTime();
  };

  const normalRows = s.records.filter((r) => r.status === 'normal' && inRange(r, start, end));
  const prevRows = s.records.filter((r) => r.status === 'normal' && inRange(r, prevUtc.start, prevUtc.end));

  const catName = new Map(s.categories.map((c) => [c.id, c.name]));
  const userName = new Map(s.users.map((u) => [u.id, u.nickname || u.username]));

  // 趋势：按桶 + 维度分组
  const cell = new Map<string, number>();
  normalRows.forEach((r) => {
    const key = `${bucketKeyOf(granularity, new Date(r.submitTime))}#${groupBy === 'user' ? r.userId : r.categoryId}`;
    cell.set(key, (cell.get(key) || 0) + 1);
  });
  const gids = Array.from(new Set(normalRows.map((r) => (groupBy === 'user' ? r.userId : r.categoryId))));
  const series = gids
    .map((gid) => {
      const data = buckets.map((b) => cell.get(`${b.key}#${gid}`) || 0);
      const total = data.reduce((a, b) => a + b, 0);
      return {
        key: gid,
        name: groupBy === 'user' ? userName.get(gid) || `已删除用户 #${gid}` : catName.get(gid) || `已删除分类 #${gid}`,
        data,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  // 分类占比
  const pieMap = new Map<number, number>();
  normalRows.forEach((r) => pieMap.set(r.categoryId, (pieMap.get(r.categoryId) || 0) + 1));
  const pie = Array.from(pieMap.entries())
    .map(([id, value]) => ({ id, name: catName.get(id) || `已删除分类 #${id}`, value }))
    .sort((a, b) => b.value - a.value);

  // 周期对比
  const currentTotals = buckets.map((_, i) => series.reduce((sum, se) => sum + (se.data[i] || 0), 0));
  const prevBuckets = buildBuckets(granularity, prev.from, prev.to);
  const prevBucketMap = new Map<string, number>();
  prevRows.forEach((r) => {
    const k = bucketKeyOf(granularity, new Date(r.submitTime));
    prevBucketMap.set(k, (prevBucketMap.get(k) || 0) + 1);
  });
  const prevTotals = buckets.map((_, i) => {
    const pb = prevBuckets[i];
    return pb ? prevBucketMap.get(pb.key) || 0 : 0;
  });

  const total = currentTotals.reduce((a, b) => a + b, 0);
  const prevTotal = prevTotals.reduce((a, b) => a + b, 0);
  const today = todayInAppTz();
  const voidTotal = s.records.filter((r) => r.status === 'void' && inRange(r, start, end)).length;
  const todayTotal = s.records.filter((r) => r.status === 'normal' && dayOfAppTz(r.submitTime) === today).length;
  const activeUsers = new Set(normalRows.map((r) => r.userId)).size;

  return {
    meta: { granularity, groupBy, from, to, prevFrom: prev.from, prevTo: prev.to, timezone: APP_TZ },
    buckets: buckets.map((b) => ({ key: b.key, label: b.label, startUtc: b.startUtc })),
    series,
    pie,
    comparison: { labels: buckets.map((b) => b.label), current: currentTotals, previous: prevTotals },
    summary: {
      total,
      prevTotal,
      growth: prevTotal === 0 ? (total > 0 ? 100 : 0) : Number((((total - prevTotal) / prevTotal) * 100).toFixed(1)),
      voidTotal,
      todayTotal,
      activeUsers,
    },
  };
}

/* ---------------- 对外 adapter ---------------- */

export async function demoAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
  const method = String(config.method || 'get').toUpperCase();
  const path = String(config.url || '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/api/, '')
    .split('?')[0];

  await getState();
  // 轻微延迟，让 loading 态、进度条在演示时也能看到
  await sleep(60 + Math.random() * 90);

  try {
    return await handle(config, method, path);
  } catch (e) {
    if (e instanceof DemoError) throw toAxiosError(config, e);
    throw toAxiosError(config, new DemoError(500, (e as Error)?.message || '演示模式内部错误'));
  }
}
