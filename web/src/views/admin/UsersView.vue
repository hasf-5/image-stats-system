<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-full md:basis-auto">
        <h2 class="page-title hidden md:block">用户管理</h2>
        <p class="muted mt-1">账号只能由管理员创建，系统不开放注册</p>
      </div>
      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <el-button class="lg:hidden" @click="filterOpen = !filterOpen">
          <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
          </svg>
          筛选
        </el-button>
        <el-button type="primary" @click="openCreate">
          <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          新建账号
        </el-button>
      </div>
    </div>

    <!-- 筛选：桌面常驻，移动端折叠 -->
    <div v-if="!isMobile || filterOpen" class="card card-pad mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3">
        <div class="lg:w-56">
          <label class="field-label">搜索</label>
          <el-input
            v-model="query.keyword"
            placeholder="账号或昵称"
            clearable
            @keyup.enter="onSearch"
          />
        </div>
        <div class="lg:w-36">
          <label class="field-label">角色</label>
          <el-select v-model="query.role" placeholder="全部" clearable class="w-full">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </div>
        <div class="lg:w-36">
          <label class="field-label">状态</label>
          <el-select v-model="query.status" placeholder="全部" clearable class="w-full">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </div>
        <div class="flex gap-2 lg:ml-auto">
          <el-button class="flex-1 lg:flex-none" @click="resetQuery">重置</el-button>
          <el-button type="primary" class="flex-1 lg:flex-none" @click="onSearch">查询</el-button>
        </div>
      </div>
    </div>

    <ResponsiveTable
      v-model:page="page"
      v-model:page-size="pageSize"
      :columns="columns"
      :data="list"
      :loading="loading"
      :total="total"
      :actions-width="190"
      empty-text="暂无用户"
    >
      <template #user="{ row }">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-8 h-8 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center shrink-0">
            {{ (row.nickname || row.username).slice(0, 1).toUpperCase() }}
          </span>
          <div class="min-w-0 leading-5">
            <p class="font-medium text-slate-900 truncate">{{ row.nickname || row.username }}</p>
            <p class="text-[11px] text-slate-400 truncate">{{ row.username }}</p>
          </div>
        </div>
      </template>

      <template #role="{ row }">
        <el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small" effect="light">
          {{ row.role === 'admin' ? '管理员' : '普通用户' }}
        </el-tag>
      </template>

      <template #status="{ row }">
        <span class="inline-flex items-center gap-1.5 text-[13px]">
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="row.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'"
          ></span>
          {{ row.status === 'active' ? '启用' : '已禁用' }}
        </span>
      </template>

      <template #imageCount="{ row }">
        <span class="tabular">{{ row.imageCount }}</span>
      </template>

      <template #createdAt="{ row }">{{ fmtDate(row.createdAt) }}</template>

      <template #actions="{ row, mobile }">
        <template v-if="mobile">
          <button class="flex items-center gap-2" @click="openEdit(row)">编辑资料</button>
          <button class="flex items-center gap-2" @click="onResetPwd(row)">重置密码</button>
          <button
            class="flex items-center gap-2"
            :class="row.status === 'active' ? 'danger' : ''"
            @click="onToggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用账号' : '启用账号' }}
          </button>
          <button class="flex items-center gap-2 danger" @click="onDelete(row)">删除账号</button>
        </template>
        <template v-else>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" size="small" @click="onResetPwd(row)">重置密码</el-button>
          <el-button
            link
            size="small"
            :type="row.status === 'active' ? 'danger' : 'success'"
            @click="onToggleStatus(row)"
          >
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-dropdown trigger="click" placement="bottom-end">
            <el-button link type="info" size="small">更多⋯</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="onDelete(row)">删除账号</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </template>
    </ResponsiveTable>

    <!-- 新建 / 编辑 -->
    <ResponsiveModal
      v-model="formVisible"
      :title="mode === 'create' ? '新建账号' : '编辑账号'"
      :loading="saving"
      :confirm-text="mode === 'create' ? '创建账号' : '保存'"
      @confirm="onSubmit"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pt-1">
        <el-form-item label="账号" prop="username">
          <el-input
            v-model="form.username"
            :disabled="mode === 'edit'"
            placeholder="登录账号，字母/数字/下划线"
            size="large"
            autocomplete="off"
          />
          <p v-if="mode === 'edit'" class="text-[11px] text-slate-400 mt-1">账号创建后不可修改</p>
        </el-form-item>

        <el-form-item v-if="mode === 'create'" label="初始密码" prop="password">
          <el-input v-model="form.password" type="text" placeholder="8-32 位，含字母和数字" size="large" autocomplete="new-password" />
          <p class="text-[11px] text-slate-400 mt-1">用户首次登录后会提示修改密码</p>
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="显示名称，如：张伟" size="large" maxlength="50" />
        </el-form-item>

        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="角色" prop="role">
            <el-select v-model="form.role" class="w-full" size="large" :disabled="mode === 'edit' && isSelf">
              <el-option label="普通用户" value="user" />
              <el-option label="管理员" value="admin" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status" class="w-full" size="large" :disabled="mode === 'edit' && isSelf">
              <el-option label="启用" value="active" />
              <el-option label="禁用" value="disabled" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
    </ResponsiveModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import ResponsiveTable, { type TableColumn } from '@/components/ResponsiveTable.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import {
  apiAdminUsers,
  apiCreateUser,
  apiDeleteUser,
  apiResetPwd,
  apiUpdateUser,
  type AdminUser,
} from '@/api/admin';
import { fmtDate } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';
import { useIsMobile } from '@/utils/useIsMobile';

const auth = useAuthStore();
const isMobile = useIsMobile();
const filterOpen = ref(false);

const list = ref<AdminUser[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const saving = ref(false);
const formVisible = ref(false);
const mode = ref<'create' | 'edit'>('create');
const editingId = ref<number | null>(null);
const formRef = ref<FormInstance>();

const query = reactive({ keyword: '', role: '', status: '' });
const form = reactive({
  username: '',
  password: '',
  nickname: '',
  role: 'user' as 'admin' | 'user',
  status: 'active' as 'active' | 'disabled',
});

const isSelf = computed(() => editingId.value === auth.user?.id);

const columns = computed<TableColumn[]>(() => [
  { key: 'user', label: '用户', minWidth: 180, primary: true, slot: 'user' },
  { key: 'role', label: '角色', width: 100, slot: 'role' },
  { key: 'status', label: '状态', width: 100, slot: 'status' },
  { key: 'imageCount', label: '记录数', width: 90, align: 'right', slot: 'imageCount' },
  { key: 'createdAt', label: '创建时间', width: 120, slot: 'createdAt' },
]);

const rules: FormRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 50, message: '账号长度 2-50 位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_.-]+$/, message: '仅支持字母、数字、下划线、点、短横线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/, message: '8-32 位，且同时包含字母和数字', trigger: 'blur' },
  ],
  nickname: [{ max: 50, message: '昵称最多 50 字', trigger: 'blur' }],
};

onMounted(fetch);
watch([page, pageSize], () => fetch());

async function fetch() {
  loading.value = true;
  try {
    const res = await apiAdminUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: query.keyword || undefined,
      role: query.role || undefined,
      status: query.status || undefined,
    });
    list.value = res.list;
    total.value = res.total;
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  if (page.value === 1) fetch();
  else page.value = 1;
}

function resetQuery() {
  query.keyword = '';
  query.role = '';
  query.status = '';
  onSearch();
}

function openCreate() {
  mode.value = 'create';
  editingId.value = null;
  Object.assign(form, { username: '', password: '', nickname: '', role: 'user', status: 'active' });
  formVisible.value = true;
  formRef.value?.clearValidate();
}

function openEdit(row: AdminUser) {
  mode.value = 'edit';
  editingId.value = row.id;
  Object.assign(form, {
    username: row.username,
    password: '',
    nickname: row.nickname || '',
    role: row.role,
    status: row.status,
  });
  formVisible.value = true;
  formRef.value?.clearValidate();
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    if (mode.value === 'create') {
      await apiCreateUser({
        username: form.username.trim(),
        password: form.password,
        nickname: form.nickname.trim() || undefined,
        role: form.role,
        status: form.status,
      });
      ElMessage.success('账号已创建');
    } else if (editingId.value) {
      await apiUpdateUser(editingId.value, {
        nickname: form.nickname.trim(),
        role: isSelf.value ? undefined : form.role,
        status: isSelf.value ? undefined : form.status,
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

async function onToggleStatus(row: AdminUser) {
  const next = row.status === 'active' ? 'disabled' : 'active';
  const verb = next === 'disabled' ? '禁用' : '启用';
  try {
    await ElMessageBox.confirm(`确定要${verb}账号「${row.username}」吗？`, `${verb}账号`, {
      confirmButtonText: verb,
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await apiUpdateUser(row.id, { status: next });
    ElMessage.success(`已${verb}`);
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}

async function onResetPwd(row: AdminUser) {
  try {
    await ElMessageBox.confirm(
      `将为「${row.username}」生成新的随机密码，原密码立即失效。`,
      '重置密码',
      { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  try {
    const res = await apiResetPwd(row.id);
    try {
      await navigator.clipboard.writeText(res.password);
    } catch {
      /* 非 https 环境可能不可用，不影响展示 */
    }
    await ElMessageBox.alert(
      `账号：${res.username}\n新密码：${res.password}\n\n密码已尝试复制到剪贴板，仅显示这一次，请立即告知用户，并提醒登录后修改。`,
      '密码已重置',
      { confirmButtonText: '我知道了', type: 'success' },
    );
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '重置失败');
  }
}

async function onDelete(row: AdminUser) {
  try {
    await ElMessageBox.confirm(
      `确定删除账号「${row.username}」吗？有图片记录的用户只能禁用，无法删除。`,
      '删除账号',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await apiDeleteUser(row.id);
    ElMessage.success('已删除');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
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
