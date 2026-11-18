<template>
  <nav class="space-y-1">
    <router-link
      v-for="item in menus"
      :key="item.name"
      :to="{ name: item.name }"
      class="group flex items-center gap-3 h-11 rounded-lg text-sm transition-colors"
      :class="[
        collapsed ? 'justify-center px-0' : 'px-3',
        isActive(item.name)
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ]"
      :title="collapsed ? item.label : undefined"
      @click="$emit('navigate')"
    >
      <svg
        viewBox="0 0 24 24"
        class="w-[18px] h-[18px] shrink-0"
        :class="isActive(item.name) ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path :d="item.icon" />
      </svg>
      <span v-if="!collapsed">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

defineProps<{ collapsed?: boolean }>();
defineEmits<{ (e: 'navigate'): void }>();

const route = useRoute();

const menus = [
  {
    name: 'admin-dashboard',
    label: '统计看板',
    icon: 'M4 19V5M4 19h16M7.5 15.5l3.2-4 2.6 2.2 3.9-4.7',
  },
  { name: 'admin-records', label: '图片记录', icon: 'M4 6h16M4 12h16M4 18h10' },
  {
    name: 'admin-users',
    label: '用户管理',
    icon: 'M15.5 19.5c0-1.9-1.6-3.5-3.5-3.5s-3.5 1.6-3.5 3.5M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7M18 11.2a2.6 2.6 0 100-5.2',
  },
  {
    name: 'admin-categories',
    label: '分类管理',
    icon: 'M3 7.2l9-4.2 9 4.2-9 4.2-9-4.2zM3 12.2l9 4.2 9-4.2M3 17.2l9 4.2 9-4.2',
  },
  {
    name: 'admin-reports',
    label: '报表配置',
    icon: 'M6 3.5h8.5L19 8v12.5H6zM14 3.5V8h4.5M9 12.5h6M9 16h4',
  },
];

function isActive(name: string) {
  return route.name === name;
}
</script>
