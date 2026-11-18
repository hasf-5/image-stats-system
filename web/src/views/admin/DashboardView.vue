<template>
  <div class="space-y-4">
    <!-- 顶部：标题 + 桌面筛选 -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="page-title hidden md:block">统计看板</h2>
        <p class="muted mt-1">
          {{ metaText }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <el-button class="lg:hidden" @click="filterOpen = true">
          <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
          </svg>
          筛选
        </el-button>
        <el-button :loading="exporting" @click="onExport">
          <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          导出 CSV
        </el-button>
      </div>
    </div>

    <!-- 桌面端筛选条 -->
    <div class="card card-pad hidden lg:block">
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="field-label">统计粒度</label>
          <el-radio-group v-model="filters.granularity" @change="onGranularityChange">
            <el-radio-button value="day">按天</el-radio-button>
            <el-radio-button value="week">按周</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
        </div>

        <div class="w-40">
          <label class="field-label">分组维度</label>
          <el-select v-model="filters.group_by" class="w-full">
            <el-option label="按分类" value="category" />
            <el-option label="按用户" value="user" />
          </el-select>
        </div>

        <div class="w-[280px]">
          <label class="field-label">时间区间</label>
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="!w-full"
            @change="load"
          />
        </div>

        <el-button type="primary" @click="load">查询</el-button>

        <div class="ml-auto text-right">
          <p class="text-[11px] text-slate-400 leading-4">统计口径</p>
          <p class="text-xs text-slate-600">仅统计正常记录，已作废不计入</p>
        </div>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <div v-for="kpi in kpis" :key="kpi.label" class="card p-4 md:p-5">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-slate-500">{{ kpi.label }}</span>
          <span class="w-8 h-8 rounded-lg flex items-center justify-center" :class="kpi.iconBg">
            <svg viewBox="0 0 24 24" class="w-4 h-4" :class="kpi.iconColor" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="kpi.icon" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <p class="mt-2 text-2xl md:text-[28px] font-bold text-slate-900 tabular leading-none">{{ kpi.value }}</p>
        <p class="mt-2 text-[11px] leading-4" :class="kpi.hintClass">{{ kpi.hint }}</p>
      </div>
    </div>

    <!-- 图表区 -->
    <div v-loading="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="lg:col-span-2">
        <ChartBox
          title="提交趋势"
          :subtitle="`按${granularityLabel} · 按${filters.group_by === 'user' ? '用户' : '分类'}分组`"
          :option="lineOption"
          :height="340"
          :empty="!stats?.summary.total"
        />
      </div>

      <ChartBox
        title="分类占比"
        subtitle="当前区间各分类提交量"
        :option="pieOption"
        :height="300"
        :empty="!stats?.pie.length"
      />

      <ChartBox
        title="周期对比"
        :subtitle="`本期 vs 上一周期（${stats?.meta.prevFrom || '-'} ~ ${stats?.meta.prevTo || '-'}）`"
        :option="barOption"
        :height="300"
        :empty="!stats?.summary.total && !stats?.summary.prevTotal"
      />
    </div>

    <p class="text-[11px] leading-5 text-slate-400">
      数据按 Asia/Shanghai（UTC+8）分桶，数据库以 UTC 存储；「作废」记录在所有统计中排除。
    </p>

    <!-- 移动端筛选抽屉 -->
    <ResponsiveModal v-model="filterOpen" title="统计筛选" :show-footer="false">
      <div class="space-y-4">
        <div>
          <label class="field-label">统计粒度</label>
          <el-radio-group v-model="filters.granularity" class="w-full" @change="onGranularityChange">
            <el-radio-button value="day" class="flex-1">按天</el-radio-button>
            <el-radio-button value="week" class="flex-1">按周</el-radio-button>
            <el-radio-button value="month" class="flex-1">按月</el-radio-button>
          </el-radio-group>
        </div>

        <div>
          <label class="field-label">分组维度</label>
          <el-radio-group v-model="filters.group_by" class="w-full" @change="onMobileApply">
            <el-radio-button value="category" class="flex-1">按分类</el-radio-button>
            <el-radio-button value="user" class="flex-1">按用户</el-radio-button>
          </el-radio-group>
        </div>

        <div>
          <label class="field-label">时间区间</label>
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="!w-full"
          />
        </div>

        <div class="flex gap-2 pt-1">
          <el-button class="flex-1 !h-11" @click="resetRange">重置区间</el-button>
          <el-button type="primary" class="flex-1 !h-11" @click="onMobileApply">应用</el-button>
        </div>

        <p class="text-[11px] text-slate-400 leading-5">仅统计正常记录，已作废不计入。</p>
      </div>
    </ResponsiveModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { EChartsOption } from 'echarts';
import ChartBox from '@/components/ChartBox.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import { apiStats, apiStatsCsv, type StatsParams, type StatsResult } from '@/api/stats';
import { daysAgoStr, todayStr } from '@/utils/format';

const route = useRoute();

const PALETTE = [
  '#4560f0',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#64748b',
];

const loading = ref(false);
const exporting = ref(false);
const filterOpen = ref(false);
const stats = ref<StatsResult | null>(null);

const filters = reactive<{
  granularity: 'day' | 'week' | 'month';
  group_by: 'category' | 'user';
  dateRange: [string, string] | null;
}>({
  granularity: 'day',
  group_by: 'category',
  dateRange: [daysAgoStr(29), todayStr()],
});

const granularityLabel = computed(
  () => ({ day: '天', week: '周', month: '月' })[filters.granularity],
);

const metaText = computed(() => {
  const m = stats.value?.meta;
  if (!m) return '加载中…';
  return `${m.from} 至 ${m.to} · ${granularityLabel.value}维度 · ${m.groupBy === 'user' ? '按用户' : '按分类'}`;
});

function params(): StatsParams {
  return {
    granularity: filters.granularity,
    group_by: filters.group_by,
    from: filters.dateRange?.[0],
    to: filters.dateRange?.[1],
  };
}

async function load() {
  loading.value = true;
  try {
    stats.value = await apiStats(params());
  } catch {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}

/** 切换粒度时把区间调到有意义的长度，避免"按月"只有 1 个点 */
function onGranularityChange() {
  const days = filters.granularity === 'day' ? 29 : filters.granularity === 'week' ? 83 : 364;
  filters.dateRange = [daysAgoStr(days), todayStr()];
  load();
}

function resetRange() {
  onGranularityChange();
}

function onMobileApply() {
  filterOpen.value = false;
  load();
}

onMounted(() => {
  // 支持从「报表配置」带参跳转：/admin/dashboard?granularity=&group_by=&from=&to=
  const q = route.query;
  if (q.granularity === 'day' || q.granularity === 'week' || q.granularity === 'month') {
    filters.granularity = q.granularity;
  }
  if (q.group_by === 'user' || q.group_by === 'category') {
    filters.group_by = q.group_by;
  }
  if (typeof q.from === 'string' && typeof q.to === 'string') {
    filters.dateRange = [q.from, q.to];
  }
  load();
});

/* ---------------- KPI ---------------- */
const kpis = computed(() => {
  const s = stats.value?.summary;
  const growth = s?.growth ?? 0;
  const up = growth >= 0;
  return [
    {
      label: '区间提交量',
      value: (s?.total ?? 0).toLocaleString(),
      icon: 'M4 19V5M4 19h16M7.5 15.5l3.2-4 2.6 2.2 3.9-4.7',
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-600',
      hint: s ? `上期 ${s.prevTotal} 张 · 环比 ${up ? '+' : ''}${growth}%` : ' — ',
      hintClass: up ? 'text-emerald-600' : 'text-red-500',
    },
    {
      label: '今日提交',
      value: (s?.todayTotal ?? 0).toLocaleString(),
      icon: 'M7 3v3M17 3v3M4 8h16M5 21h14a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v14a1 1 0 001 1z',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hint: '按上海时区自然日统计',
      hintClass: 'text-slate-400',
    },
    {
      label: '活跃提交人',
      value: (s?.activeUsers ?? 0).toLocaleString(),
      icon: 'M15.5 19.5c0-1.9-1.6-3.5-3.5-3.5s-3.5 1.6-3.5 3.5M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      hint: '区间内有提交记录的用户',
      hintClass: 'text-slate-400',
    },
    {
      label: '区间作废',
      value: (s?.voidTotal ?? 0).toLocaleString(),
      icon: 'M5 5l14 14M12 21a9 9 0 100-18 9 9 0 000 18z',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      hint: '已从统计中排除',
      hintClass: 'text-slate-400',
    },
  ];
});

/* ---------------- 图表 option ---------------- */
const axisStyle = {
  axisLine: { lineStyle: { color: '#e2e8f0' } },
  axisTick: { show: false },
  axisLabel: { color: '#94a3b8', fontSize: 11 },
  splitLine: { lineStyle: { color: '#f1f5f9' } },
};

const lineOption = computed<EChartsOption>(() => {
  const s = stats.value;
  const labels = s?.buckets.map((b) => b.label) ?? [];
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,23,42,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: '#cbd5e1', type: 'dashed' } },
    },
    legend: {
      type: 'scroll',
      top: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    grid: { left: 4, right: 12, top: 42, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisStyle },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle },
    series: (s?.series ?? []).map((se) => ({
      name: se.name,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' as const },
      areaStyle: (s?.series.length ?? 0) === 1 ? { opacity: 0.12 } : undefined,
      data: se.data,
    })),
  };
});

const pieOption = computed<EChartsOption>(() => {
  const pie = stats.value?.pie ?? [];
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15,23,42,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}<br/>{c} 张（{d}%）',
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '66%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: true, fontSize: 12, fontWeight: 'bold', formatter: '{b}\n{d}%' },
        },
        data: pie.map((p) => ({ name: p.name, value: p.value })),
      },
    ],
  };
});

const barOption = computed<EChartsOption>(() => {
  const c = stats.value?.comparison;
  return {
    color: ['#4560f0', '#cbd5e1'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,23,42,.92)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    grid: { left: 4, right: 12, top: 20, bottom: 34, containLabel: true },
    xAxis: { type: 'category', data: c?.labels ?? [], ...axisStyle },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle },
    series: [
      {
        name: '本期',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: c?.current ?? [],
      },
      {
        name: '上期',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: c?.previous ?? [],
      },
    ],
  };
});

/* ---------------- 导出 ---------------- */
async function onExport() {
  exporting.value = true;
  try {
    const blob = await apiStatsCsv(params());
    if (blob.type.includes('application/json')) {
      const text = await blob.text();
      const msg = JSON.parse(text)?.msg || '导出失败';
      throw new Error(msg);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `统计_${filters.granularity}_${filters.group_by}_${filters.dateRange?.[0]}_${filters.dateRange?.[1]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    ElMessage.success('导出已开始');
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}
</style>
