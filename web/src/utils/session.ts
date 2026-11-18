export type Role = 'admin' | 'user';

export interface AuthUser {
  id: number;
  username: string;
  nickname: string | null;
  role: Role;
  mustChangePwd?: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const KEY = 'imgstats.session';

let memory: Session | null = null;

export function loadSession(): Session | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.accessToken || !parsed?.user) return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  memory = s;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function patchAccessToken(accessToken: string, refreshToken?: string) {
  const cur = loadSession();
  if (!cur) return;
  saveSession({ ...cur, accessToken, refreshToken: refreshToken || cur.refreshToken });
}

export function clearSession() {
  memory = null;
  localStorage.removeItem(KEY);
}
