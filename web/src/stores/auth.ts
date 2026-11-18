import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { apiLogin, apiLogout, apiMe, type LoginPayload } from '@/api/auth';
import { clearSession, loadSession, saveSession, type AuthUser, type Session } from '@/utils/session';

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(loadSession());

  const user = computed<AuthUser | null>(() => session.value?.user ?? null);
  const isLoggedIn = computed(() => !!session.value?.accessToken);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function login(payload: LoginPayload) {
    const res = await apiLogin(payload);
    const next: Session = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
    };
    saveSession(next);
    session.value = next;
    return res.user;
  }

  async function logout() {
    const rt = session.value?.refreshToken;
    try {
      if (rt) await apiLogout(rt);
    } catch {
      /* 网络异常也要清本地 */
    } finally {
      clearSession();
      session.value = null;
    }
  }

  /** 刷新页面后校验 token 是否仍有效，并同步最新角色/昵称 */
  async function syncProfile() {
    if (!session.value) return null;
    try {
      const me = await apiMe();
      if (session.value) {
        const next = { ...session.value, user: me };
        saveSession(next);
        session.value = next;
      }
      return me;
    } catch {
      return null;
    }
  }

  function clear() {
    clearSession();
    session.value = null;
  }

  return { session, user, isLoggedIn, isAdmin, login, logout, syncProfile, clear };
});
