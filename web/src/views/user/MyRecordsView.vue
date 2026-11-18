<template>
  <div>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-full md:basis-auto">
        <h2 class="page-title">我的记录</h2>
        <p class="muted mt-1">共 {{ total }} 条提交记录</p>
      </div>
      <el-button class="md:hidden" @click="filterOpen = true">
        <svg viewBox="0 0 24 24" class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
        </svg>
        筛选
      </el-button>
    </div>

    <!-- 桌面端内联筛选 -->
    <div class="card card-pad mb-4 hidden md:block">
      <ImageFilterForm v-model="filters" :categories="categories" @search="onSearch" />
    </div>

    <ResponsiveTable
      v-model:page="page"
      v-model:page-size="pageSize"
      :columns="columns"
      :data="list"
      :loading="loading"
      :total="total"
      empty-text="还没有提交记录，去上传第一张图片吧"
    >
      <!-- PC 缩略图 -->
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

      <!-- 移动端整行大图 -->
      <template #thumbMobile="{ row }">
        <el-image
          :src="row.fileUrl"
          :preview-src-list="[row.fileUrl]"
          preview-teleported
          hide-on-click-modal
          fit="cover"
          class="w-full h-40 rounded-lg bg-slate-100"
        />
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
          <p class="text-[11px] text-slate-400">{{ fromNow(row.submitTime) }}</p>
        </div>
      </template>

      <template #status="{ row }">
        <el-tag v-if="row.status === 'normal'" type="success" size="small" effect="light">正常</el-tag>
        <el-tooltip v-else :content="row.voidReason || '已作废'" placement="top">
          <el-tag type="info" size="small" effect="light">已作废</el-tag>
        </el-tooltip>
      </template>

      <template #fileSize="{ row }">{{ fmtSize(row.fileSize) }}</template>

      <template #actions="{ row, mobile }">
        <template v-if="mobile">
          <button class="flex items-center gap-2" @click="preview(row)">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="2.8" />
            </svg>
            查看大图
          </button>
          <button v-if="canVoid(row)" class="flex items-center gap-2 danger" @click="onVoid(row)">作废此记录</button>
        </template>
        <template v-else>
          <el-button link type="primary" size="small" @click="preview(row)">预览</el-button>
          <el-button v-if="canVoid(row)" link type="danger" size="small" @click="onVoid(row)">作废</el-button>
        </template>
      </template>
    </ResponsiveTable>

    <!-- 移动端筛选抽屉 -->
    <ResponsiveModal v-model="filterOpen" title="筛选记录" :show-footer="false">
      <ImageFilterForm v-model="filters" :categories="categories" @search="onMobileSearch" />
    </ResponsiveModal>

    <!-- 大图预览 -->
    <el-image-viewer
      v-if="viewerUrl"
      :url-list="[viewerUrl]"
      :initial-index="0"
      teleported
      hide-on-click-modal
      @close="viewerUrl = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import ResponsiveTable, { type TableColumn } from '@/components/ResponsiveTable.vue';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import ImageFilterForm, { type FilterState } from '@/components/ImageFilterForm.vue';
import { apiMyImages, apiVoidOwn, type ImageRecord, type MiniCategory } from '@/api/images';
import { apiPublicCategories } from '@/api/admin';
import { fmtDateTime, fmtSize, fromNow, TZ, todayStr } from '@/utils/format';
import { useIsMobile } from '@/utils/useIsMobile';

const isMobile = useIsMobile();
const categories = ref<MiniCategory[]>([]);
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
    // PC 小图，移动端整行大图，共用同一列定义
    slot: isMobile.value ? 'thumbMobile' : 'thumb',
  },
  { key: 'category', label: '分类', width: 110, primary: true, slot: 'category' },
  { key: 'remark', label: '备注', minWidth: 200, slot: 'remark' },
  { key: 'submitTime', label: '提交时间', width: 150, slot: 'submitTime' },
  { key: 'fileSize', label: '大小', width: 90, slot: 'fileSize' },
  { key: 'status', label: '状态', width: 90, slot: 'status' },
]);

onMounted(async () => {
  try {
    categories.value = await apiPublicCategories();
  } catch {
    /* ignore */
  }
  await fetch();
});

watch([page, pageSize], () => fetch());

async function fetch() {
  loading.value = true;
  try {
    const res = await apiMyImages({
      page: page.value,
      pageSize: pageSize.value,
      categoryId: filters.categoryId || undefined,
      status: filters.status || undefined,
      from: filters.dateRange?.[0],
      to: filters.dateRange?.[1],
    });
    list.value = res.list;
    total.value = res.total;
  } catch {
    /* 拦截器已提示 */
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

/** 仅当天、且状态正常的记录允许本人作废 */
function canVoid(row: ImageRecord) {
  if (row.status !== 'normal') return false;
  return dayjs(row.submitTime).tz(TZ).format('YYYY-MM-DD') === todayStr();
}

function preview(row: ImageRecord) {
  viewerUrl.value = row.fileUrl;
}

async function onVoid(row: ImageRecord) {
  try {
    await ElMessageBox.confirm('作废后该记录将从统计中排除，确定继续吗？', '作废记录', {
      confirmButtonText: '作废',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await apiVoidOwn(row.id, '本人作废');
    ElMessage.success('已作废');
    fetch();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}
</script>
