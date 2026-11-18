/**
 * 演示模式入口。
 *
 * 开启方式：`npm run build:demo`（vite --mode demo，会注入 VITE_DEMO_MODE=1）
 * 作用：用浏览器内的 adapter 顶替真实后端，使静态托管（GitHub Pages）上
 *      也能完整走通登录、上传、作废、统计、用户管理等全部功能。
 */
import axios from 'axios';
import { demoAdapter } from './adapter';
import { resetDemo } from './store';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

/** 把 axios 的请求全部转给浏览器内实现（含拦截器里的裸 axios 刷新调用） */
export function installDemo() {
  if (!DEMO_MODE) return;
  axios.defaults.adapter = demoAdapter as never;
  // 演示环境没有真实网络，超时/代理都无意义，统一放宽
  axios.defaults.timeout = 30000;
}

export { resetDemo };
