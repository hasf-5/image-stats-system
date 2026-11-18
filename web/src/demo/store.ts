/**
 * 演示模式的数据层：状态 + IndexedDB 持久化 + 种子数据。
 *
 * 设计要点：
 *  - 图片不重复存进每条记录，记录只存 img key，图片本体放 state.images，
 *    这样 2000+ 条种子记录也不会把 IndexedDB 撑爆。
 *  - IndexedDB 不可用（隐私模式等）时自动退回 localStorage。
 *  - 所有写操作走 mutate()，统一拍快照 + 防抖落盘。
 */
import dayjs from 'dayjs';
import { APP_TZ } from './time';

export type Role = 'admin' | 'user';
export type RecordStatus = 'normal' | 'void';

export interface DemoUser {
  id: number;
  username: string;
  password: string;
  nickname: string | null;
  role: Role;
  status: 'active' | 'disabled';
  mustChangePwd: boolean;
  createdAt: string;
  createdBy: number | null;
}

export interface DemoCategory {
  id: number;
  name: string;
  sort: number;
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface DemoRecord {
  id: number;
  userId: number;
  categoryId: number;
  /** state.images 的 key */
  img: string;
  fileSize: number;
  fileHash: string;
  remark: string | null;
  status: RecordStatus;
  /** UTC ISO 字符串，与后端存 UTC 一致 */
  submitTime: string;
  voidBy: number | null;
  voidTime: string | null;
  voidReason: string | null;
  clientType: 'mobile' | 'pc' | null;
}

export interface DemoReport {
  id: number;
  name: string;
  granularity: 'day' | 'week' | 'month';
  groupBy: 'category' | 'user';
  dateStart: string | null;
  dateEnd: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface DemoAudit {
  id: number;
  userId: number | null;
  action: string;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface DemoState {
  version: number;
  seededAt: string;
  users: DemoUser[];
  categories: DemoCategory[];
  records: DemoRecord[];
  reports: DemoReport[];
  audits: DemoAudit[];
  images: Record<string, string>;
  seq: { user: number; category: number; record: number; report: number; audit: number };
  /** 登录锁定：username -> 解锁时间戳 */
  locks: Record<string, number>;
  /** 登录失败计数：username -> { count, resetAt } */
  fails: Record<string, { count: number; resetAt: number }>;
  /** token 黑名单：jti -> 过期时间戳(s) */
  blacklist: Record<string, number>;
}

const DB_NAME = 'imgstats-demo';
const STORE = 'kv';
const STATE_KEY = 'state';
const LS_KEY = 'imgstats.demo.state';

let state: DemoState | null = null;
let loading: Promise<DemoState> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/* ---------------- IndexedDB ---------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/* ---------------- 种子数据 ---------------- */

/** 用 canvas 生成几张占位图，避免依赖任何外部图片资源 */
function makeSeedImage(index: number): string {
  const w = 480;
  const h = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const palettes: [string, string][] = [
    ['#1d4ed8', '#60a5fa'],
    ['#0e7490', '#22d3ee'],
    ['#b45309', '#fbbf24'],
    ['#7c3aed', '#c084fc'],
    ['#15803d', '#4ade80'],
    ['#be123c', '#fb7185'],
  ];
  const [c1, c2] = palettes[index % palettes.length];

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  for (let x = -h; x < w; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 34px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('演示图片', 36, h - 92);
  ctx.font = '500 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(`SAMPLE #${index + 1}`, 36, h - 56);

  return canvas.toDataURL('image/jpeg', 0.78);
}

function isoOfShanghai(date: string, hour: number, minute: number): string {
  return dayjs.tz(`${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`, APP_TZ).toISOString();
}

function buildSeed(): DemoState {
  const now = dayjs();
  const createdAt = now.subtract(90, 'day').toISOString();

  const users: DemoUser[] = [
    {
      id: 1,
      username: 'admin',
      password: 'Admin@123456',
      nickname: '系统管理员',
      role: 'admin',
      status: 'active',
      mustChangePwd: false,
      createdAt,
      createdBy: null,
    },
    ...[
      { username: 'zhangwei', nickname: '张伟' },
      { username: 'lina', nickname: '李娜' },
      { username: 'wangqiang', nickname: '王强' },
    ].map((u, i) => ({
      id: i + 2,
      username: u.username,
      password: 'User@123456',
      nickname: u.nickname,
      role: 'user' as Role,
      status: 'active' as const,
      mustChangePwd: false,
      createdAt,
      createdBy: 1,
    })),
  ];

  const categories: DemoCategory[] = ['产品图片', '现场记录', '票据凭证', '其他'].map((name, i) => ({
    id: i + 1,
    name,
    sort: i,
    status: 'active' as const,
    createdAt,
  }));

  const images: Record<string, string> = {};
  for (let i = 0; i < 6; i++) images[`seed${i}`] = makeSeedImage(i);

  // 60 天数据：分类基数 + 周末低谷 + 缓慢增长，看起来像真实使用曲线
  const catBase = [18, 13, 9, 6];
  const records: DemoRecord[] = [];
  let rid = 0;
  for (let d = 59; d >= 0; d--) {
    const day = now.subtract(d, 'day');
    const dateStr = day.format('YYYY-MM-DD');
    const dow = day.day();
    const weekend = dow === 0 || dow === 6 ? 0.45 : 1;
    const growth = 0.7 + 0.6 * ((59 - d) / 59);

    categories.forEach((cat, ci) => {
      const avg = catBase[ci % catBase.length] * growth * weekend;
      const noise = (Math.random() - 0.5) * Math.max(1, avg * 0.22);
      const count = Math.max(0, Math.round(avg + noise));
      for (let k = 0; k < count; k++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const hour = 8 + Math.floor(Math.random() * 11);
        const minute = Math.floor(Math.random() * 60);
        const isVoid = Math.random() < 0.055;
        const submitTime = isoOfShanghai(dateStr, hour, minute);
        rid += 1;
        records.push({
          id: rid,
          userId: user.id,
          categoryId: cat.id,
          img: `seed${Math.floor(Math.random() * 6)}`,
          fileSize: 9000 + Math.floor(Math.random() * 24000),
          fileHash: `seed-${rid}`,
          remark: Math.random() < 0.3 ? '演示数据' : null,
          status: isVoid ? 'void' : 'normal',
          submitTime,
          voidBy: isVoid ? 1 : null,
          voidTime: isVoid ? dayjs(submitTime).add(1, 'hour').toISOString() : null,
          voidReason: isVoid ? '演示：重复上传' : null,
          clientType: Math.random() < 0.6 ? 'mobile' : 'pc',
        });
      }
    });
  }

  const reports: DemoReport[] = [
    {
      id: 1,
      name: '近 30 天各分类提交量',
      granularity: 'day',
      groupBy: 'category',
      dateStart: null,
      dateEnd: null,
      createdBy: 1,
      createdAt,
    },
    {
      id: 2,
      name: '月度按人员统计',
      granularity: 'month',
      groupBy: 'user',
      dateStart: null,
      dateEnd: null,
      createdBy: 1,
      createdAt,
    },
  ];

  return {
    version: 1,
    seededAt: now.toISOString(),
    users,
    categories,
    records,
    reports,
    audits: [],
    images,
    seq: { user: users.length, category: categories.length, record: rid, report: reports.length, audit: 0 },
    locks: {},
    fails: {},
    blacklist: {},
  };
}

/* ---------------- 存取 ---------------- */

export function getState(): Promise<DemoState> {
  if (state) return Promise.resolve(state);
  if (loading) return loading;
  loading = (async () => {
    let loaded = await idbGet<DemoState>(STATE_KEY);
    if (!loaded) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) loaded = JSON.parse(raw) as DemoState;
      } catch {
        /* ignore */
      }
    }
    // 版本不符（种子结构变更）时重建
    if (!loaded || loaded.version !== 1) {
      loaded = buildSeed();
      await idbSet(STATE_KEY, loaded);
    }
    state = loaded;
    return loaded;
  })();
  return loading;
}

export function current(): DemoState {
  if (!state) throw new Error('demo state not loaded');
  return state;
}

export function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!state) return;
    const snapshot = state;
    snapshot.blacklist = pruneBlacklist(snapshot.blacklist);
    const ok = await idbSet(STATE_KEY, snapshot);
    if (!ok) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
      } catch {
        /* 超出配额就只保留在内存里 */
      }
    }
  }, 180);
}

function pruneBlacklist(map: Record<string, number>) {
  const nowSec = Math.floor(Date.now() / 1000);
  const out: Record<string, number> = {};
  Object.entries(map).forEach(([k, v]) => {
    if (v > nowSec) out[k] = v;
  });
  return out;
}

/** 统一的写入口：改完状态后调用，负责落盘 */
export function mutate<T>(fn: (s: DemoState) => T): T {
  const s = current();
  const result = fn(s);
  persist();
  return result;
}

/** 重置演示数据（登录页提供入口，方便随时恢复干净状态） */
export async function resetDemo() {
  state = buildSeed();
  await idbSet(STATE_KEY, state);
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

export function nextId(key: keyof DemoState['seq']): number {
  const s = current();
  s.seq[key] += 1;
  return s.seq[key];
}
