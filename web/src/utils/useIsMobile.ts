import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 统一断点：≤768px 视为移动端，与 Tailwind 的 md(769px) 保持一致。
 * 用于「同一套组件渲染成 el-dialog 或 el-drawer」这类必须走 JS 判断的场景。
 */
export function useIsMobile() {
  const isMobile = ref(false);
  let mql: MediaQueryList | null = null;
  const handler = (e: MediaQueryListEvent) => (isMobile.value = e.matches);

  onMounted(() => {
    mql = window.matchMedia('(max-width: 768px)');
    isMobile.value = mql.matches;
    mql.addEventListener('change', handler);
  });
  onBeforeUnmount(() => mql?.removeEventListener('change', handler));

  return isMobile;
}
