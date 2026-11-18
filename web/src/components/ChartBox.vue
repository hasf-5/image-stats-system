<template>
  <div class="chart-box card overflow-hidden">
    <div class="flex items-start justify-between gap-3 px-4 pt-4 md:px-5">
      <div class="min-w-0">
        <h3 class="text-[15px] font-semibold text-slate-900 truncate">{{ title }}</h3>
        <p v-if="subtitle" class="mt-0.5 text-xs text-slate-500 truncate">{{ subtitle }}</p>
      </div>
      <div class="shrink-0">
        <slot name="extra" />
      </div>
    </div>

    <div class="relative px-1 pb-2 md:px-2">
      <div ref="el" class="w-full" :style="{ height: heightPx }"></div>
      <div
        v-if="!loading && empty"
        class="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-400 pointer-events-none"
      >
        <svg viewBox="0 0 24 24" class="w-9 h-9 mb-2 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4 19V5M4 19h16" stroke-linecap="round" />
          <path d="M7.5 15l3-3.5 2.5 2 3.5-4.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        当前区间暂无数据
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    option: EChartsOption;
    height?: number;
    loading?: boolean;
    empty?: boolean;
  }>(),
  { subtitle: '', height: 320, loading: false, empty: false },
);

const el = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

const heightPx = ref(`${props.height}px`);

function resize() {
  chart?.resize();
}

function render() {
  if (!el.value) return;
  if (!chart) {
    chart = echarts.init(el.value, undefined, { renderer: 'canvas' });
  }
  chart.setOption(props.option, true);
}

onMounted(async () => {
  await nextTick();
  // 移动端图表降高，避免一屏塞不下
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  heightPx.value = `${isMobile ? Math.min(props.height, 260) : props.height}px`;
  await nextTick();
  render();

  // 关键：容器宽度变化（侧边栏收起/展开、旋转屏幕）时自动 resize
  if (typeof ResizeObserver !== 'undefined' && el.value) {
    ro = new ResizeObserver(() => resize());
    ro.observe(el.value);
  }
  window.addEventListener('orientationchange', resize);
});

watch(
  () => props.option,
  () => render(),
  { deep: true },
);

onBeforeUnmount(() => {
  ro?.disconnect();
  window.removeEventListener('orientationchange', resize);
  chart?.dispose();
  chart = null;
});

defineExpose({ resize, getChart: () => chart });
</script>
