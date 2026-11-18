import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * 两种构建形态：
 *  - 默认（npm run build）：给真后端用，base 为 /，history 路由
 *  - demo（npm run build:demo，即 --mode demo）：给 GitHub Pages 等静态托管用，
 *    base 为相对路径、hash 路由、/api 请求由浏览器内 adapter 接管
 */
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    base: isDemo ? './' : '/',
    plugins: [vue()],
    define: {
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(isDemo ? '1' : '0'),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // 开发环境把 /api 与 /uploads 代理到 NestJS，避免 CORS 与图片 404
        '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
        '/uploads': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      },
    },
    build: {
      target: 'es2019',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // 按端拆包：登录/用户端/后台端各自独立，首屏只加载登录壳
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts';
            if (id.includes('element-plus')) return 'vendor-element';
            if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue';
            return 'vendor';
          },
        },
      },
    },
  };
});
