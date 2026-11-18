<template>
  <div class="responsive-table">
    <!-- 桌面端：el-table -->
    <div v-if="!isMobile" class="hidden md:block">
      <el-table
        v-loading="loading"
        :data="data"
        :row-key="rowKey"
        stripe
        :header-cell-style="{ background: '#f8fafc' }"
        :empty-text="emptyText"
        class="w-full"
      >
        <el-table-column
          v-for="col in columns"
          :key="col.key"
          :prop="col.key"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth || 110"
          :align="col.align || 'left'"
          :fixed="col.fixed"
        >
          <template #default="scope">
            <slot :name="col.slot || col.key" :row="scope.row" :value="scope.row[col.key]">
              {{ scope.row[col.key] ?? '-' }}
            </slot>
          </template>
        </el-table-column>

        <el-table-column
          v-if="hasActions"
          label="操作"
          :width="actionsWidth"
          fixed="right"
          align="right"
        >
          <template #default="scope">
            <div class="flex items-center justify-end gap-1">
              <slot name="actions" :row="scope.row" :mobile="false" />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 移动端：卡片列表（同一份 columns 定义） -->
    <div v-else class="md:hidden" v-loading="loading">
      <div v-if="!data.length && !loading" class="py-14 text-center text-sm text-slate-400">
        {{ emptyText }}
      </div>

      <div v-else class="space-y-3">
        <div v-for="row in data" :key="(row as any)[rowKey]" class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 text-[15px] font-semibold text-slate-900 leading-6">
              <slot :name="primaryColumn.slot || primaryColumn.key" :row="row" :value="(row as any)[primaryColumn.key]">
                {{ (row as any)[primaryColumn.key] ?? '-' }}
              </slot>
            </div>

            <el-dropdown v-if="hasActions" trigger="click" placement="bottom-end" popper-class="mobile-action-menu">
              <button
                type="button"
                class="shrink-0 h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 text-[13px] flex items-center gap-1 tap"
              >
                更多
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <div class="action-sheet">
                    <slot name="actions" :row="row" :mobile="true" />
                  </div>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div v-if="mobileFullWidth.length" class="mt-3 space-y-2">
            <div v-for="col in mobileFullWidth" :key="col.key">
              <slot :name="col.slot || col.key" :row="row" :value="(row as any)[col.key]">
                {{ (row as any)[col.key] ?? '-' }}
              </slot>
            </div>
          </div>

          <div v-if="mobileColumns.length" class="mt-3 space-y-1.5">
            <div
              v-for="col in mobileColumns"
              :key="col.key"
              class="flex items-start justify-between gap-4 text-[13px] leading-5"
            >
              <span class="text-slate-500 shrink-0">{{ col.label }}</span>
              <span class="text-slate-800 text-right min-w-0 break-all">
                <slot :name="col.slot || col.key" :row="row" :value="(row as any)[col.key]">
                  {{ (row as any)[col.key] ?? '-' }}
                </slot>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页：桌面完整，移动端简化 -->
    <div v-if="showPager && total > 0" class="mt-4 flex items-center justify-between gap-3">
      <template v-if="!isMobile">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="(p: number) => emit('update:page', p)"
          @size-change="(s: number) => emit('update:pageSize', s)"
        />
      </template>
      <template v-else>
        <span class="text-[13px] text-slate-500">
          共 {{ total }} 条 · {{ page }}/{{ totalPages }} 页
        </span>
        <div class="flex items-center gap-2">
          <el-button size="small" :disabled="page <= 1" @click="emit('update:page', page - 1)">上一页</el-button>
          <el-button size="small" :disabled="page >= totalPages" @click="emit('update:page', page + 1)">下一页</el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { useIsMobile } from '@/utils/useIsMobile';

export interface TableColumn {
  key: string;
  label: string;
  width?: number | string;
  minWidth?: number | string;
  align?: 'left' | 'center' | 'right';
  slot?: string;
  fixed?: 'left' | 'right' | boolean;
  /** 移动端卡片不展示该字段 */
  mobileHide?: boolean;
  /** 指定为移动端卡片标题（默认第一列） */
  primary?: boolean;
  /** 移动端卡片中占满整行（用于缩略图等），不显示 label */
  fullWidth?: boolean;
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    data: any[];
    loading?: boolean;
    rowKey?: string;
    total?: number;
    page?: number;
    pageSize?: number;
    showPager?: boolean;
    emptyText?: string;
    actionsWidth?: number;
  }>(),
  {
    loading: false,
    rowKey: 'id',
    total: 0,
    page: 1,
    pageSize: 20,
    showPager: true,
    emptyText: '暂无数据',
    actionsWidth: 180,
  },
);

const emit = defineEmits<{
  (e: 'update:page', v: number): void;
  (e: 'update:pageSize', v: number): void;
}>();

const isMobile = useIsMobile();
const slots = useSlots();
const hasActions = computed(() => !!slots.actions);

const primaryColumn = computed(
  () => props.columns.find((c) => c.primary) || props.columns[0] || { key: 'id', label: 'ID' },
);

const mobileColumns = computed(() =>
  props.columns.filter((c) => c !== primaryColumn.value && !c.mobileHide && !c.fullWidth),
);

const mobileFullWidth = computed(() =>
  props.columns.filter((c) => c !== primaryColumn.value && !c.mobileHide && c.fullWidth),
);

const totalPages = computed(() => Math.max(1, Math.ceil((props.total || 0) / (props.pageSize || 20))));
</script>

<style>
/* 移动端「更多」菜单里的操作项：把普通按钮渲染成菜单行 */
.mobile-action-menu {
  min-width: 132px;
}
.mobile-action-menu .action-sheet {
  padding: 4px 0;
}
.mobile-action-menu .action-sheet button {
  display: block;
  width: 100%;
  padding: 10px 18px;
  text-align: left;
  font-size: 14px;
  color: #334155;
  background: transparent;
  border: 0;
  line-height: 1.4;
}
.mobile-action-menu .action-sheet button:active {
  background: #f1f5f9;
}
.mobile-action-menu .action-sheet button.danger {
  color: #dc2626;
}
.mobile-action-menu .action-sheet button:disabled {
  color: #cbd5e1;
}
</style>
