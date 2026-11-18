import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import './style.css';
import App from './App.vue';
import router from './router';
import { DEMO_MODE, installDemo } from './demo';

// 演示模式下所有 /api 请求由浏览器内 adapter 接管，必须在任何请求前执行
installDemo();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn, size: 'default', zIndex: 2000 });

app.mount('#app');

// PWA：仅注册 Service Worker（生产环境），支持添加到主屏幕与离线壳缓存
// 演示模式不注册，避免旧缓存导致 Pages 上的更新拿不到
if ('serviceWorker' in navigator && import.meta.env.PROD && !DEMO_MODE) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* 忽略注册失败，不影响主功能 */
    });
  });
}
