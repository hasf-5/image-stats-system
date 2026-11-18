import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { loadSession } from '@/utils/session';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: () => {
      const s = loadSession();
      if (!s) return '/login';
      return s.user.role === 'admin' ? '/admin/dashboard' : '/user/upload';
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/user',
    component: () => import('@/layouts/UserLayout.vue'),
    meta: { role: 'user' },
    children: [
      { path: '', redirect: '/user/upload' },
      {
        path: 'upload',
        name: 'user-upload',
        component: () => import('@/views/user/UploadView.vue'),
        meta: { title: '提交图片', role: 'user' },
      },
      {
        path: 'my',
        name: 'user-my',
        component: () => import('@/views/user/MyRecordsView.vue'),
        meta: { title: '我的记录', role: 'user' },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { role: 'admin' },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/DashboardView.vue'),
        meta: { title: '统计看板', role: 'admin' },
      },
      {
        path: 'records',
        name: 'admin-records',
        component: () => import('@/views/admin/RecordsView.vue'),
        meta: { title: '图片记录', role: 'admin' },
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/UsersView.vue'),
        meta: { title: '用户管理', role: 'admin' },
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
        meta: { title: '分类管理', role: 'admin' },
      },
      {
        path: 'reports',
        name: 'admin-reports',
        component: () => import('@/views/admin/ReportsView.vue'),
        meta: { title: '报表配置', role: 'admin' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/**
 * 路由守卫只做「体验层」跳转：未登录去登录页、角色不符回各自首页。
 * 真正的权限校验在 NestJS 的 JwtAuthGuard + RolesGuard。
 */
router.beforeEach((to) => {
  const session = loadSession();
  document.title = to.meta.title ? `${to.meta.title} · 图片统计系统` : '图片统计系统';

  if (to.meta.public) {
    if (session && to.path === '/login') {
      return session.user.role === 'admin' ? '/admin/dashboard' : '/user/upload';
    }
    return true;
  }

  if (!session) {
    return { path: '/login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } };
  }

  const needRole = to.meta.role as 'admin' | 'user' | undefined;
  if (needRole && session.user.role !== needRole) {
    return session.user.role === 'admin' ? '/admin/dashboard' : '/user/upload';
  }
  return true;
});

export default router;
