<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-full md:basis-auto">
        <h2 class="page-title hidden md:block">图片记录</h2>
        <p class="muted mt-1">共 {{ total }} 条 · 作废后自动从统计中排除</p>
      </div>
      <el-button class="lg:hidden ml-auto" @click="filterOpen = true">
        <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
        </svg>
        筛选
      </el-button>
    </div>

    <div class="card card-pad mb-4 hidden lg:block">
      <ImageFilterForm
        v-model="filters"
        :categories="categories"
        :users="users"
        show-keyword
        show-user
        @search="onSearch"
      />
    </div>

    <ResponsiveTable
      v-model:page="page"
      v-model:page-size="pageSize"
      :columns="columns"
      :data="list"
      :loading="loading"
      :total="total"
      :actions-width="150"
      empty-text="没有符合条件的记录"
    >
      <template #thumb="{ row }">
        <el-image
          :src="row.fileUrl"
          :preview-src-list="[row.fileUrl]"
          preview-teleported
          hide-on-click-modal
          fit="cover"
          class="w-11 h-11 rounded-md bg-slate-100 cursor-zoom-in"
        />
      </template>

      <template #thumbMobile="{ row }">
        <el-image
          :src="row.fileUrl"
          :preview-src-list="[row.fileUrl]"
          preview-teleported
          hide-on-click-modal
          fit="cover"
          class="w-full h-32 rounded-lg bg-slate-100"
        />
      </template>

      <template #submitter="{ row }">
        <div class="leading-5">
          <p class="font-medium text-slate-900 truncate">{{ row.user?.nickname || row.user?.username || '已删除用户' }}</p>
          <p class="text-[11px] text-slate-400 truncate">{{ row.user?.username }}</p>
        </div>
      </template>

      <template #category="{ row }">
        <span class="inline-flex items-center h-6 px-2 rounded-md bg-slate-100 text-slate-700 text-xs">
          {{ row.category?.name || '未分类' }}
        </span>
      </template>

      <template #remark="{ row }">
        <span class="line-clamp-2 text-slate-700">{{ row.remark || '—' }}</span>
      </template>

      <template #submitTime="{ row }">
        <div class="leading-5">
          <p class="text-slate-800">{{ fmtDateTime(row.submitTime) }}</p>
          <p class="text-[11px] text-slate-400">
            {{ row.clientType === 'mobile' ? '手机端' : row.clientType === 'pc' ? '电脑端' : '—' }}
          </p>
        </div>
      </template>

      <template #status="{ row }">
        <el-tag v-if="row.status === 'normal'" type="success" size="small" effect="light">正常</el-tag>
        <el-tooltip v-else placement="top" :content="voidTip(row)">
          <el-tag type="info" size="small" effect="light">已作废</el-tag>
        </el-tooltip>
      </template>

      <template #fileSize="{ row }">{{ fmtSize(row.fileSize) }}</template>

      <template #actions="{ row, mobile }">
        <template v-if="mobile">
          <button class="flex items-center gap-2" @click="preview(row)">查看大图</button>
          <button v-if="row.status === 'normal'" class="flex items-center gap-2 danger" @click="onVoid(row)">作废记录</button>
          <button v-else class="flex items-center gap-2" @click="onRestore(row)">恢复记录</button>
        </template>
        <template v-else>
          <el-button link type="primary" size="small" @click="preview(row)">预览</el-button>
          <el-button v-if="row.status === 'normal'" link type="danger" size="small" @click="onVoid(row)">作废</el-button>
          <el-button v-else link type="warning" size="small" @click="onRestore(row)">恢复</el-button>
        </template>
      </template>
    </ResponsiveTable>

    <ResponsiveModal v-model="filterOpen" title="筛选记录" :show-footer="false">
      <ImageFilterForm
        v-model="filters"
        :categories="categories"
        :users="users"
        show-keyword
        show-user
        @search="onMobileSearch"
      />
    </ResponsiveModal>

    <el-image-viewer
      v-if="viewerUrl"
      :url-list="[viewerUrl]"
      teleported
      hide-on-click-modal
      @close="viewerUrl = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ResponsiveTable, { type TableColumn } from '@/components/ResponsiveTable.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import ImageFilterForm, { type FilterState } from '@/components/ImageFilterForm.vue';
import {
  apiAdminImages,
  apiAdminRestore,
  apiAdminUsers,
  apiAdminVoid,
  apiCategories,
  type CategoryItem,
} from '@/api/admin';
import type { ImageRecord, MiniUser } from '@/api/images';
import { fmtDateTime, fmtSize } from '@/utils/format';
import { useIsMobile } from '@/utils/useIsMobile';

const isMobile = useIsMobile();
const categories = ref<CategoryItem[]>([]);
const users = ref<MiniUser[]>([]);
const list = ref<ImageRecord[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const filterOpen = ref(false);
const viewerUrl = ref('');

const filters = reactive<FilterState>({
  keyword: '',
  categoryId: null,
  userId: null,
  status: '',
  dateRange: null,
});

const columns = computed<TableColumn[]>(() => [
  {
    key: 'thumb',
    label: '图片',
    width: 76,
    fullWidth: true,
    slot: isMobile.value ? 'thumbMobile' : 'thumb',
  },
  { key: 'submitter', label: '提交人', width: 130, primary: true, slot: 'submitter' },
  { key: 'category', label: '分类', width: 100, slot: 'category' },
  { key: 'remark', label: '备注', minWidth: 160, slot: 'remark' },
  { key: 'submitTime', label: '提交时间', width: 145, slot: 'submitTime' },
  { key: 'fileSize', label: '大小', width: 80, slot: 'fileSize' },
  { key: 'status', label: '状态', width: 88, slot: 'status' },
]);

onMounted(async () => {
  await Promise.all([loadOptions(), fetch()]);
});

watch([page, pageSize], () => fetch());

async function loadOptions() {
  try {
    const [cats, us] = await Promise.all([
      apiCategories(true),
      apiAdminUsers({ page: 1, pageSize: 100 }),
    ]);
    categories.value = cats;
    users.value = us.list;
  } catch {
    /* ignore */
  }
}

async function fetch() {
  loading.value = true;
  try {
    const res = await apiAdminImages({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      categoryId: filters.categoryId || undefined,
      userId: filters.userId || undefined,
      status: filters.status || undefined,
      from: filters.dateRange?.[0],
      to: filters.dateRange?.[1],
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

function onMobileSearch() {
  filterOpen.value = false;
  onSearch();
}

function preview(row: ImageRecord) {
  viewerUrl.value = row.fileUrl;
}

function voidTip(row: ImageRecord) {
  const t = row.voidTime ? ` · ${fmtDateTime(row.voidTime)}` : '';
  return `${row.voidReason || '已作废'}${t}`;
}

async function onVoid(row: ImageRecord) {
  let reason = '';
  try {
    const { value } = await ElMessageBox.prompt('作废后该记录不计入统计，可填写原因备查。', '作废记录', {
      confirmButtonText: '确认作废',
      cancelButtonText: '取消',
      inputPlaceholder: '作废原因（选填）',
      inputType: 'textarea',
      inputValidator: () => true,
      type: 'warning',
    });
    reason = value || '';
  } catch {
    return;
  }
  try {
    await apiAdminVoid(row.id, reason);
    ElMessage.success('已作废');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}

async function onRestore(row: ImageRecord) {
  try {
    await ElMessageBox.confirm('恢复后该记录将重新计入统计，确定继续吗？', '恢复记录', {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
      type: 'info',
    });
  } catch {
    return;
  }
  try {
    await apiAdminRestore(row.id);
    ElMessage.success('已恢复');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}
</script>
