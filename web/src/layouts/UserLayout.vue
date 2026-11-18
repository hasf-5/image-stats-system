<template>
  <div class="min-h-screen-dvh flex flex-col bg-[#f6f7fb]">
    <header
      class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100 pt-safe"
    >
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <!-- 品牌 -->
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" class="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" stroke-width="1.9">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
              <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 20" stroke-linecap="round" />
            </svg>
          </div>
          <span class="hidden sm:block text-[15px] font-semibold text-slate-900 truncate">图片提交系统</span>
        </div>

        <!-- 端内导航 -->
        <nav class="flex items-center bg-slate-100 rounded-full p-0.5">
          <router-link
            v-for="tab in tabs"
            :key="tab.name"
            :to="{ name: tab.name }"
            class="px-3.5 md:px-4 h-8 rounded-full text-[13px] font-medium flex items-center transition-colors"
            :class="
              route.name === tab.name
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
          >
            {{ tab.label }}
          </router-link>
        </nav>

        <!-- 用户菜单 -->
        <el-dropdown trigger="click" placement="bottom-end">
          <button
            type="button"
            class="w-8 h-8 rounded-full bg-slate-900 text-white text-[13px] font-medium flex items-center justify-center tap shrink-0"
            aria-label="账号菜单"
          >
            {{ avatarText }}
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <div class="px-3.5 py-2.5 border-b border-slate-100">
                <p class="text-[13px] font-medium text-slate-900 leading-5">{{ auth.user?.nickname || auth.user?.username }}</p>
                <p class="text-xs text-slate-400 leading-4">{{ auth.user?.role === 'admin' ? '管理员' : '普通用户' }}</p>
              </div>
              <el-dropdown-item @click="pwdVisible = true">修改密码</el-dropdown-item>
              <el-dropdown-item divided @click="onLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="flex-1 w-full max-w-4xl mx-auto px-4 py-4 md:py-6 flex flex-col">
      <router-view />
    </main>

    <ChangePasswordDialog v-model="pwdVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const pwdVisible = ref(false);

const tabs = [
  { name: 'user-upload', label: '提交图片' },
  { name: 'user-my', label: '我的记录' },
];

const avatarText = computed(() => {
  const n = auth.user?.nickname || auth.user?.username || '?';
  return n.slice(0, 1).toUpperCase();
});

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await auth.logout();
  router.replace('/login');
}
</script>
