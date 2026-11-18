/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bcd0ff',
          300: '#93b1ff',
          400: '#6686fb',
          500: '#4560f0',
          600: '#3344dd',
          700: '#2b37b8',
          800: '#283192',
          900: '#262e74',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.18)',
        float: '0 12px 40px -12px rgba(16,24,40,.28)',
      },
      screens: {
        // 与需求断点一致：md=768 移动端/桌面端分界，lg=1024 侧边栏展开
        md: '769px',
        lg: '1025px',
      },
    },
  },
  plugins: [],
};
