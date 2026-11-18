<template>
  <div class="min-h-screen-dvh flex bg-[#f6f7fb]">
    <!-- 侧边栏：>1024px 展开 240px；768~1024px 收为 64px 图标 -->
    <aside
      class="hidden md:flex shrink-0 flex-col bg-white border-r border-slate-100 transition-[width] duration-200"
      :class="sidebarExpanded ? 'w-60 min-w-[240px]' : 'w-16 min-w-[64px]'"
    >
      <div class="h-14 flex items-center gap-2.5 border-b border-slate-100" :class="sidebarExpanded ? 'px-4' : 'justify-center px-0'">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="1.9">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
            <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 20" stroke-linecap="round" />
          </svg>
        </div>
        <div v-if="sidebarExpanded" class="min-w-0">
          <p class="text-[14px] font-semibold text-slate-900 leading-5 truncate">图片统计系统</p>
          <p class="text-[11px] text-slate-400 leading-4">管理后台</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto py-3" :class="sidebarExpanded ? 'px-3' : 'px-2'">
        <AdminNav :collapsed="!sidebarExpanded" />
      </div>

      <div class="border-t border-slate-100 p-3">
        <div v-if="sidebarExpanded" class="flex items-center gap-2.5 px-1">
          <div class="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center shrink-0">
            {{ avatarText }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-medium text-slate-800 truncate">{{ auth.user?.nickname || auth.user?.username }}</p>
            <p class="text-[11px] text-slate-400">管理员</p>
          </div>
          <el-dropdown trigger="click" placement="top-end">
            <button class="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400" aria-label="账号菜单">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="pwdVisible = true">修改密码</el-dropdown-item>
                <el-dropdown-item divided @click="onLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-tooltip v-else content="退出登录" placement="right">
          <button
            class="w-10 h-10 mx-auto rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
            aria-label="退出登录"
            @click="onLogout"
          >
            <svg viewBox="0 0 24 24" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M15 17l5-5-5-5M20 12H9M12 4H5v16h7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </el-tooltip>
      </div>
    </aside>

    <!-- 主内容 -->
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur border-b border-slate-100 flex items-center gap-3 px-4 pt-safe">
        <!-- 移动端汉堡 -->
        <button
          class="md:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
          aria-label="打开菜单"
          @click="drawerVisible = true"
        >
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
          </svg>
        </button>

        <div class="min-w-0 flex-1">
          <!-- 移动端：当前页标题（页面内不再重复大标题） -->
          <h1 class="md:hidden text-[15px] font-semibold text-slate-900 truncate">
            {{ route.meta.title || '管理后台' }}
          </h1>
          <!-- 桌面端：面包屑，避免与页面内标题重复 -->
          <div class="hidden md:flex items-center gap-1.5 text-[13px] text-slate-400">
            <span>管理后台</span>
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="text-slate-700 font-medium truncate">{{ route.meta.title }}</span>
          </div>
        </div>

        <el-dropdown trigger="click" placement="bottom-end">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 tap"
          >
            <span class="w-7 h-7 rounded-full bg-slate-900 text-white text-[12px] font-medium flex items-center justify-center">
              {{ avatarText }}
            </span>
            <span class="hidden sm:block text-[13px] text-slate-600 max-w-[120px] truncate">
              {{ auth.user?.nickname || auth.user?.username }}
            </span>
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-slate-400 hidden sm:block" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="pwdVisible = true">修改密码</el-dropdown-item>
              <el-dropdown-item divided @click="onLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>

      <main class="flex-1 p-4 md:p-6 min-w-0">
        <router-view />
      </main>
    </div>

    <!-- 移动端抽屉菜单 -->
    <el-drawer v-model="drawerVisible" direction="ltr" size="264px" :with-header="false">
      <div class="flex flex-col h-full">
        <div class="flex items-center gap-2.5 px-1 pb-4 border-b border-slate-100">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <svg viewBox="0 0 24 24" class="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" stroke-width="1.9">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
              <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 20" stroke-linecap="round" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">图片统计系统</p>
            <p class="text-[11px] text-slate-400">管理后台</p>
          </div>
        </div>

        <div class="flex-1 py-3 overflow-y-auto">
          <AdminNav :collapsed="false" @navigate="drawerVisible = false" />
        </div>

        <div class="border-t border-slate-100 pt-3 pb-safe space-y-1">
          <div class="flex items-center gap-2.5 px-2 pb-3">
            <div class="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">
              {{ avatarText }}
            </div>
            <div class="min-w-0">
              <p class="text-[13px] font-medium text-slate-800 truncate">{{ auth.user?.nickname || auth.user?.username }}</p>
              <p class="text-[11px] text-slate-400">管理员</p>
            </div>
          </div>
          <button class="w-full h-10 px-3 rounded-lg text-left text-sm text-slate-600 hover:bg-slate-100" @click="pwdVisible = true">
            修改密码
          </button>
          <button class="w-full h-10 px-3 rounded-lg text-left text-sm text-red-600 hover:bg-red-50" @click="onLogout">
            退出登录
          </button>
        </div>
      </div>
    </el-drawer>

    <ChangePasswordDialog v-model="pwdVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import AdminNav from '@/components/AdminNav.vue';
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const drawerVisible = ref(false);
const pwdVisible = ref(false);
const sidebarExpanded = ref(true);

/** 侧边栏仅在 >1024px 展开，否则收为图标栏 */
let mql: MediaQueryList | null = null;
const onMql = (e: MediaQueryListEvent) => (sidebarExpanded.value = e.matches);

onMounted(() => {
  mql = window.matchMedia('(min-width: 1025px)');
  sidebarExpanded.value = mql.matches;
  mql.addEventListener('change', onMql);
});
onBeforeUnmount(() => mql?.removeEventListener('change', onMql));

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
  drawerVisible.value = false;
  await auth.logout();
  router.replace('/login');
}
</script>
