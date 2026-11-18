<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-full md:basis-auto">
        <h2 class="page-title hidden md:block">报表配置</h2>
        <p class="muted mt-1">保存常用统计视角，一键在看板中打开</p>
      </div>
      <el-button type="primary" class="ml-auto" @click="openCreate">
        <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        新建配置
      </el-button>
    </div>

    <ResponsiveTable
      :columns="columns"
      :data="list"
      :loading="loading"
      :show-pager="false"
      :actions-width="220"
      empty-text="还没有报表配置，创建一个常用视角吧"
    >
      <template #name="{ row }">
        <div class="min-w-0">
          <p class="font-medium text-slate-900 truncate">{{ row.name }}</p>
          <p class="text-[11px] text-slate-400 truncate">
            {{ row.date_start || '不限' }} ~ {{ row.date_end || '至今' }}
          </p>
        </div>
      </template>

      <template #granularity="{ row }">
        <span class="text-slate-700">{{ granularityText(row.granularity) }}</span>
      </template>

      <template #groupBy="{ row }">
        <span class="text-slate-700">{{ row.group_by === 'user' ? '按用户' : '按分类' }}</span>
      </template>

      <template #createdAt="{ row }">{{ fmtDate(row.createdAt) }}</template>

      <template #actions="{ row, mobile }">
        <template v-if="mobile">
          <button class="flex items-center gap-2" @click="apply(row)">在看板中打开</button>
          <button class="flex items-center gap-2" @click="openEdit(row)">编辑</button>
          <button class="flex items-center gap-2 danger" @click="onDelete(row)">删除</button>
        </template>
        <template v-else>
          <el-button link type="primary" size="small" @click="apply(row)">打开</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </template>
    </ResponsiveTable>

    <ResponsiveModal
      v-model="formVisible"
      :title="mode === 'create' ? '新建报表配置' : '编辑报表配置'"
      :loading="saving"
      :confirm-text="mode === 'create' ? '创建配置' : '保存'"
      @confirm="onSubmit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pt-1">
        <el-form-item label="配置名称" prop="name">
          <el-input v-model="form.name" placeholder="如：本月分类统计" size="large" maxlength="80" show-word-limit />
        </el-form-item>

        <el-form-item label="统计粒度" prop="granularity">
          <el-radio-group v-model="form.granularity" class="w-full">
            <el-radio-button value="day" class="flex-1">按天</el-radio-button>
            <el-radio-button value="week" class="flex-1">按周</el-radio-button>
            <el-radio-button value="month" class="flex-1">按月</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="分组维度" prop="group_by">
          <el-radio-group v-model="form.group_by" class="w-full">
            <el-radio-button value="category" class="flex-1">按分类</el-radio-button>
            <el-radio-button value="user" class="flex-1">按用户</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="默认时间区间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="!w-full"
          />
          <p class="text-[11px] text-slate-400 mt-1">留空表示使用看板默认的最近 30 天</p>
        </el-form-item>
      </el-form>
    </ResponsiveModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import ResponsiveTable, { type TableColumn } from '@/components/ResponsiveTable.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import {
  apiCreateReport,
  apiDeleteReport,
  apiReports,
  apiUpdateReport,
  type ReportConfig,
} from '@/api/admin';
import { fmtDate } from '@/utils/format';

const router = useRouter();

const list = ref<ReportConfig[]>([]);
const loading = ref(false);
const saving = ref(false);
const formVisible = ref(false);
const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const dateRange = ref<[string, string] | null>(null);

const form = reactive({
  name: '',
  granularity: 'day' as 'day' | 'week' | 'month',
  group_by: 'category' as 'category' | 'user',
});

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: '配置名称', minWidth: 180, primary: true, slot: 'name' },
  { key: 'granularity', label: '粒度', width: 90, slot: 'granularity' },
  { key: 'groupBy', label: '分组', width: 100, slot: 'groupBy' },
  { key: 'createdAt', label: '创建时间', width: 110, slot: 'createdAt' },
]);

const rules: FormRules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
};

onMounted(fetch);

async function fetch() {
  loading.value = true;
  try {
    list.value = await apiReports();
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
}

function granularityText(g: string) {
  return ({ day: '按天', week: '按周', month: '按月' } as Record<string, string>)[g] || g;
}

function openCreate() {
  mode.value = 'create';
  editingId.value = null;
  Object.assign(form, { name: '', granularity: 'day', group_by: 'category' });
  dateRange.value = null;
  formVisible.value = true;
  formRef.value?.clearValidate();
}

function openEdit(row: ReportConfig) {
  mode.value = 'edit';
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    granularity: row.granularity,
    group_by: row.group_by,
  });
  dateRange.value =
    row.date_start && row.date_end ? [row.date_start, row.date_end] : null;
  formVisible.value = true;
  formRef.value?.clearValidate();
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  const payload = {
    name: form.name.trim(),
    granularity: form.granularity,
    group_by: form.group_by,
    date_start: dateRange.value?.[0] || undefined,
    date_end: dateRange.value?.[1] || undefined,
  };

  saving.value = true;
  try {
    if (mode.value === 'create') {
      await apiCreateReport(payload);
      ElMessage.success('配置已创建');
    } else if (editingId.value) {
      await apiUpdateReport(editingId.value, payload);
      ElMessage.success('已保存');
    }
    formVisible.value = false;
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: ReportConfig) {
  try {
    await ElMessageBox.confirm(`确定删除配置「${row.name}」吗？`, '删除配置', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await apiDeleteReport(row.id);
    ElMessage.success('已删除');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}

/** 用同一套 /stats 接口 + 参数组合驱动看板，不为每种组合写死接口 */
function apply(row: ReportConfig) {
  router.push({
    name: 'admin-dashboard',
    query: {
      granularity: row.granularity,
      group_by: row.group_by,
      from: row.date_start || undefined,
      to: row.date_end || undefined,
    },
  });
}
</script>
