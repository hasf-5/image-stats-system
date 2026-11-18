<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-full md:basis-auto">
        <h2 class="page-title hidden md:block">分类管理</h2>
        <p class="muted mt-1">分类用于提交归类与统计分组，停用后用户端不再可选</p>
      </div>
      <el-button type="primary" class="ml-auto" @click="openCreate">
        <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        新建分类
      </el-button>
    </div>

    <ResponsiveTable
      :columns="columns"
      :data="list"
      :loading="loading"
      :show-pager="false"
      :actions-width="200"
      empty-text="还没有分类，先创建一个吧"
    >
      <template #name="{ row }">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold shrink-0"
            :class="row.status === 'active' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'"
          >
            {{ row.sort }}
          </span>
          <span class="font-medium text-slate-900 truncate">{{ row.name }}</span>
        </div>
      </template>

      <template #sort="{ row }">
        <span class="tabular text-slate-600">{{ row.sort }}</span>
      </template>

      <template #imageCount="{ row }">
        <span class="tabular">{{ row.imageCount }}</span>
      </template>

      <template #status="{ row }">
        <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small" effect="light">
          {{ row.status === 'active' ? '启用' : '已停用' }}
        </el-tag>
      </template>

      <template #createdAt="{ row }">{{ fmtDate(row.createdAt) }}</template>

      <template #actions="{ row, mobile }">
        <template v-if="mobile">
          <button class="flex items-center gap-2" @click="openEdit(row)">编辑</button>
          <button class="flex items-center gap-2" @click="onToggle(row)">
            {{ row.status === 'active' ? '停用分类' : '启用分类' }}
          </button>
          <button class="flex items-center gap-2 danger" @click="onDelete(row)">删除分类</button>
        </template>
        <template v-else>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            link
            size="small"
            :type="row.status === 'active' ? 'warning' : 'success'"
            @click="onToggle(row)"
          >
            {{ row.status === 'active' ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </template>
    </ResponsiveTable>

    <ResponsiveModal
      v-model="formVisible"
      :title="mode === 'create' ? '新建分类' : '编辑分类'"
      :loading="saving"
      :confirm-text="mode === 'create' ? '创建分类' : '保存'"
      @confirm="onSubmit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pt-1">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="如：产品图片" size="large" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="排序值" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="9999" class="!w-full" size="large" controls-position="right" />
          <p class="text-[11px] text-slate-400 mt-1">数值越小越靠前，用户端按此顺序展示</p>
        </el-form-item>
        <el-form-item v-if="mode === 'edit'" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </ResponsiveModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import ResponsiveTable, { type TableColumn } from '@/components/ResponsiveTable.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import {
  apiCategories,
  apiCreateCategory,
  apiDeleteCategory,
  apiUpdateCategory,
  type CategoryItem,
} from '@/api/admin';
import { fmtDate } from '@/utils/format';

const list = ref<CategoryItem[]>([]);
const loading = ref(false);
const saving = ref(false);
const formVisible = ref(false);
const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({ name: '', sort: 0, status: 'active' as 'active' | 'disabled' });

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: '分类', minWidth: 170, primary: true, slot: 'name' },
  { key: 'sort', label: '排序', width: 80, align: 'right', slot: 'sort', mobileHide: true },
  { key: 'imageCount', label: '记录数', width: 90, align: 'right', slot: 'imageCount' },
  { key: 'status', label: '状态', width: 100, slot: 'status' },
  { key: 'createdAt', label: '创建时间', width: 120, slot: 'createdAt' },
]);

const rules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度 1-50 字', trigger: 'blur' },
  ],
};

onMounted(fetch);

async function fetch() {
  loading.value = true;
  try {
    list.value = await apiCategories(true);
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  mode.value = 'create';
  editingId.value = null;
  const last = list.value[list.value.length - 1];
  Object.assign(form, { name: '', sort: (last?.sort ?? 0) + 1, status: 'active' });
  formVisible.value = true;
  formRef.value?.clearValidate();
}

function openEdit(row: CategoryItem) {
  mode.value = 'edit';
  editingId.value = row.id;
  Object.assign(form, { name: row.name, sort: row.sort, status: row.status });
  formVisible.value = true;
  formRef.value?.clearValidate();
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    if (mode.value === 'create') {
      await apiCreateCategory({ name: form.name.trim(), sort: form.sort });
      ElMessage.success('分类已创建');
    } else if (editingId.value) {
      await apiUpdateCategory(editingId.value, {
        name: form.name.trim(),
        sort: form.sort,
        status: form.status,
      });
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

async function onToggle(row: CategoryItem) {
  const next = row.status === 'active' ? 'disabled' : 'active';
  try {
    await apiUpdateCategory(row.id, { status: next });
    ElMessage.success(next === 'disabled' ? '已停用' : '已启用');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}

async function onDelete(row: CategoryItem) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${row.name}」吗？分类下已有记录时无法删除，请改为停用。`,
      '删除分类',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await apiDeleteCategory(row.id);
    ElMessage.success('已删除');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}
</script>
