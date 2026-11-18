<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
    <div v-if="showKeyword" class="lg:w-52">
      <label class="field-label">备注关键词</label>
      <el-input v-model="filters.keyword" placeholder="搜索备注内容" clearable @keyup.enter="$emit('search')" />
    </div>

    <div class="lg:w-40">
      <label class="field-label">分类</label>
      <el-select v-model="filters.categoryId" placeholder="全部分类" clearable class="w-full">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
    </div>

    <div v-if="showUser" class="lg:w-40">
      <label class="field-label">提交人</label>
      <el-select v-model="filters.userId" placeholder="全部用户" clearable filterable class="w-full">
        <el-option
          v-for="u in users"
          :key="u.id"
          :label="u.nickname ? `${u.nickname}（${u.username}）` : u.username"
          :value="u.id"
        />
      </el-select>
    </div>

    <div class="lg:w-32">
      <label class="field-label">状态</label>
      <el-select v-model="filters.status" placeholder="全部" clearable class="w-full">
        <el-option label="正常" value="normal" />
        <el-option label="已作废" value="void" />
      </el-select>
    </div>

    <div class="lg:w-[250px]">
      <label class="field-label">提交时间</label>
      <el-date-picker
        v-model="filters.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        class="!w-full"
        :shortcuts="shortcuts"
      />
    </div>

    <div class="flex gap-2 lg:ml-auto">
      <el-button class="flex-1 lg:flex-none" @click="reset">重置</el-button>
      <el-button type="primary" class="flex-1 lg:flex-none" @click="$emit('search')">查询</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MiniCategory, MiniUser } from '@/api/images';

export interface FilterState {
  keyword: string;
  categoryId: number | null;
  userId: number | null;
  status: '' | 'normal' | 'void';
  dateRange: [string, string] | null;
}

const props = withDefaults(
  defineProps<{
    modelValue: FilterState;
    categories: MiniCategory[];
    showKeyword?: boolean;
    showUser?: boolean;
    users?: MiniUser[];
  }>(),
  { showKeyword: false, showUser: false, users: () => [] },
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: FilterState): void;
  (e: 'search'): void;
}>();

const filters = computed(() => props.modelValue);

const shortcuts = [
  {
    text: '最近 7 天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return [start, end];
    },
  },
  {
    text: '最近 30 天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return [start, end];
    },
  },
  {
    text: '本月',
    value: () => {
      const now = new Date();
      return [new Date(now.getFullYear(), now.getMonth(), 1), now];
    },
  },
];

function reset() {
  emit('update:modelValue', {
    keyword: '',
    categoryId: null,
    userId: null,
    status: '',
    dateRange: null,
  });
  emit('search');
}
</script>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  color: #64748b;
}
</style>
