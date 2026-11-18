<template>
  <div class="flex flex-1 flex-col">
    <!-- 标题 -->
    <div class="mb-4 md:mb-5">
      <h2 class="page-title">提交图片</h2>
      <p class="muted mt-1">选择分类后拍照或从相册选图，提交即计入统计</p>
    </div>

    <!-- 分类 -->
    <section class="card card-pad mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-900">
          选择分类 <span class="text-red-500">*</span>
        </h3>
        <span v-if="categories.length" class="text-xs text-slate-400">共 {{ categories.length }} 个</span>
      </div>

      <div v-if="loadingCats" class="flex gap-2">
        <div v-for="i in 4" :key="i" class="h-9 w-20 rounded-full bg-slate-100 animate-pulse"></div>
      </div>

      <div v-else-if="!categories.length" class="text-sm text-slate-500 py-2">
        暂无可用分类，请联系管理员在后台添加。
      </div>

      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="h-9 px-3.5 rounded-full text-[13px] border transition-colors tap"
          :class="
            form.categoryId === cat.id
              ? 'bg-brand-600 border-brand-600 text-white font-medium shadow-sm shadow-brand-600/25'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'
          "
          @click="form.categoryId = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>
    </section>

    <!-- 选图 / 拍照 -->
    <section class="card card-pad mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-900">
          图片 <span class="text-red-500">*</span>
        </h3>
        <span class="text-xs text-slate-400">单次最多 {{ MAX_COUNT }} 张</span>
      </div>

      <!-- 移动端：两个大按钮 -->
      <div class="md:hidden grid grid-cols-2 gap-3">
        <button
          type="button"
          class="h-[92px] rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/60 flex flex-col items-center justify-center gap-2 text-brand-700 tap"
          @click="triggerCamera"
        >
          <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3 8.5A2.5 2.5 0 015.5 6h1.7l1.1-1.6A1.5 1.5 0 019.6 3.7h4.8a1.5 1.5 0 011.3.7L16.8 6h1.7A2.5 2.5 0 0121 8.5v9A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-9z" />
            <circle cx="12" cy="13" r="3.6" />
          </svg>
          <span class="text-[13px] font-medium">拍照上传</span>
        </button>

        <button
          type="button"
          class="h-[92px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-600 tap"
          @click="triggerAlbum"
        >
          <svg viewBox="0 0 24 24" class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="3" y="4.5" width="18" height="15" rx="3" />
            <circle cx="8.5" cy="10" r="1.6" fill="currentColor" stroke="none" />
            <path d="M4 17l4.6-4.4a2 2 0 012.7 0L20 20" stroke-linecap="round" />
          </svg>
          <span class="text-[13px] font-medium">从相册选择</span>
        </button>
      </div>

      <!-- 桌面端：拖拽区 -->
      <div
        class="hidden md:flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors py-8 cursor-pointer"
        :class="dragging ? 'border-brand-500 bg-brand-50/70' : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'"
        @click="triggerAlbum"
        @dragover.prevent="dragging = true"
        @dragenter.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <svg viewBox="0 0 24 24" class="w-10 h-10 text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 15v3.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V15" stroke-linecap="round" />
        </svg>
        <p class="text-sm text-slate-600">
          将图片拖到此处，或
          <span class="text-brand-600 font-medium">点击选择文件</span>
        </p>
        <p class="mt-1.5 text-xs text-slate-400">支持 JPG / PNG / WebP，单张不超过 20MB</p>
      </div>

      <!-- 隐藏 input：一个走相机，一个走相册/多选 -->
      <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPick" />
      <input ref="albumInput" type="file" accept="image/*" multiple class="hidden" @change="onPick" />

      <!-- 待提交列表 -->
      <div v-if="items.length" class="mt-4">
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-[13px] text-slate-600">
            已选 <b class="text-slate-900">{{ items.length }}</b> 张
            <span v-if="totalSize" class="text-slate-400">· {{ fmtSize(totalSize) }}</span>
          </span>
          <button type="button" class="text-[13px] text-slate-400 hover:text-red-500" @click="clearAll">清空</button>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          <div
            v-for="item in items"
            :key="item.id"
            class="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group"
          >
            <img :src="item.preview" alt="" class="w-full h-full object-cover" />

            <!-- 压缩中 -->
            <div v-if="item.status === 'compressing'" class="absolute inset-0 bg-slate-900/55 flex flex-col items-center justify-center text-white text-[11px] gap-1.5">
              <span class="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin"></span>
              压缩中
            </div>

            <!-- 成功 -->
            <div v-else-if="item.status === 'success'" class="absolute inset-0 bg-emerald-600/70 flex items-center justify-center">
              <svg viewBox="0 0 24 24" class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <!-- 失败 -->
            <div v-else-if="item.status === 'failed'" class="absolute inset-0 bg-red-600/70 flex flex-col items-center justify-center gap-1 px-1">
              <span class="text-white text-[11px] leading-4 text-center line-clamp-2">{{ item.error || '上传失败' }}</span>
              <button type="button" class="mt-0.5 px-2 py-0.5 rounded bg-white/90 text-red-600 text-[11px] font-medium" @click.stop="retry(item)">
                重试
              </button>
            </div>

            <!-- 上传中 -->
            <div v-else-if="item.status === 'uploading'" class="absolute inset-0 bg-slate-900/55 flex items-center justify-center">
              <span class="text-white text-xs font-medium tabular">{{ uploadPercent }}%</span>
            </div>

            <!-- 删除 -->
            <button
              v-if="item.status !== 'uploading'"
              type="button"
              class="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/55 text-white flex items-center justify-center backdrop-blur"
              aria-label="移除"
              @click.stop="removeItem(item)"
            >
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 整体进度 -->
        <div v-if="uploading" class="mt-3">
          <el-progress :percentage="uploadPercent" :stroke-width="6" :show-text="false" />
          <p class="mt-1.5 text-xs text-slate-500">正在上传，请保持页面打开…</p>
        </div>
      </div>
    </section>

    <!-- 备注 -->
    <section class="card card-pad mb-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">备注 <span class="text-slate-400 font-normal">（选填）</span></h3>
      <el-input
        v-model="form.remark"
        type="textarea"
        :rows="2"
        maxlength="255"
        show-word-limit
        placeholder="例如：3 号车间设备巡检"
      />
    </section>

    <!-- 提交：移动端吸底，内容不足一屏时也保持在底部 -->
    <div class="sticky-action mt-auto">
      <el-button
        type="primary"
        class="w-full !h-12 !text-[15px] !font-semibold !rounded-xl"
        :loading="uploading"
        :disabled="!canSubmit"
        @click="onSubmit"
      >
        {{ submitText }}
      </el-button>
      <p class="mt-2 text-center text-[11px] text-slate-400 md:hidden">
        提交后立即计入统计，误传可当天在「我的记录」中作废
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { apiPublicCategories } from '@/api/admin';
import { uploadImages, type MiniCategory } from '@/api/images';
import { compressImage, isMobileViewport } from '@/utils/compress';
import { fmtSize } from '@/utils/format';

const MAX_COUNT = 9;

interface Item {
  id: string;
  file: File;
  preview: string;
  status: 'compressing' | 'queued' | 'uploading' | 'success' | 'failed';
  error?: string;
}

const categories = ref<MiniCategory[]>([]);
const loadingCats = ref(true);
const items = ref<Item[]>([]);
const uploading = ref(false);
const uploadPercent = ref(0);
const dragging = ref(false);
const cameraInput = ref<HTMLInputElement>();
const albumInput = ref<HTMLInputElement>();

const form = reactive<{ categoryId: number | null; remark: string }>({
  categoryId: null,
  remark: '',
});

const totalSize = computed(() => items.value.reduce((s, i) => s + i.file.size, 0));
const pending = computed(() => items.value.filter((i) => i.status === 'queued' || i.status === 'failed'));
const canSubmit = computed(() => !!form.categoryId && pending.value.length > 0 && !uploading.value);

const submitText = computed(() => {
  if (uploading.value) return '上传中…';
  if (!pending.value.length) return '请先选择图片';
  if (!form.categoryId) return '请选择分类';
  return `提交 ${pending.value.length} 张图片`;
});

onMounted(async () => {
  try {
    categories.value = await apiPublicCategories();
    if (categories.value.length === 1) form.categoryId = categories.value[0].id;
  } catch {
    /* 错误已由拦截器提示 */
  } finally {
    loadingCats.value = false;
  }
});

onBeforeUnmount(() => items.value.forEach((i) => URL.revokeObjectURL(i.preview)));

function triggerCamera() {
  if (items.value.length >= MAX_COUNT) return ElMessage.warning(`单次最多 ${MAX_COUNT} 张`);
  cameraInput.value?.click();
}

function triggerAlbum() {
  if (items.value.length >= MAX_COUNT) return ElMessage.warning(`单次最多 ${MAX_COUNT} 张`);
  albumInput.value?.click();
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = ''; // 允许重复选择同一张
  void addFiles(files);
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (!files.length) return;
  void addFiles(files);
}

async function addFiles(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (!images.length) return ElMessage.warning('请选择图片文件');

  const room = MAX_COUNT - items.value.length;
  if (room <= 0) return ElMessage.warning(`单次最多 ${MAX_COUNT} 张`);
  if (images.length > room) ElMessage.warning(`单次最多 ${MAX_COUNT} 张，已为你保留前 ${room} 张`);

  const picked = images.slice(0, room).filter((f) => {
    if (f.size > 20 * 1024 * 1024) {
      ElMessage.warning(`${f.name} 超过 20MB，已跳过`);
      return false;
    }
    return true;
  });

  // 顺序压缩：避免移动端一次解码多张导致内存峰值
  for (const original of picked) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const placeholder: Item = {
      id,
      file: original,
      preview: URL.createObjectURL(original),
      status: 'compressing',
    };
    items.value.push(placeholder);

    const compressed = await compressImage(original);
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx < 0) continue; // 压缩期间被删除
    URL.revokeObjectURL(placeholder.preview);
    items.value[idx] = {
      id,
      file: compressed,
      preview: URL.createObjectURL(compressed),
      status: 'queued',
    };
  }
}

function removeItem(item: Item) {
  URL.revokeObjectURL(item.preview);
  items.value = items.value.filter((i) => i.id !== item.id);
}

function clearAll() {
  items.value.forEach((i) => URL.revokeObjectURL(i.preview));
  items.value = [];
}

function retry(item: Item) {
  item.status = 'queued';
  item.error = undefined;
}

async function onSubmit() {
  if (!form.categoryId) return ElMessage.warning('请先选择分类');
  if (!pending.value.length || uploading.value) return;

  const targets = pending.value;
  const files = targets.map((i) => i.file);
  uploading.value = true;
  uploadPercent.value = 0;
  targets.forEach((i) => (i.status = 'uploading'));

  try {
    const res = await uploadImages(
      files,
      {
        categoryId: form.categoryId,
        remark: form.remark.trim(),
        clientType: isMobileViewport() ? 'mobile' : 'pc',
      },
      (p) => (uploadPercent.value = p),
    );

    uploadPercent.value = 100;
    const failedIdx = new Set(res.failed.map((f) => f.index));
    targets.forEach((item, i) => {
      if (failedIdx.has(i)) {
        item.status = 'failed';
        item.error = res.failed.find((f) => f.index === i)?.reason || '上传失败';
      } else {
        item.status = 'success';
      }
    });

    if (res.success > 0) {
      ElMessage.success(`成功提交 ${res.success} 张图片`);
      form.remark = '';
    }
    if (res.failed.length) {
      ElMessage.warning(`${res.failed.length} 张未通过校验，可重试或更换图片`);
    }

    // 成功的项 1.2s 后移出列表，失败的保留以便重试
    setTimeout(() => {
      items.value
        .filter((i) => i.status === 'success')
        .forEach((i) => URL.revokeObjectURL(i.preview));
      items.value = items.value.filter((i) => i.status !== 'success');
    }, 1200);
  } catch (e: any) {
    targets.forEach((i) => {
      i.status = 'failed';
      i.error = e?.message || '上传失败';
    });
  } finally {
    uploading.value = false;
  }
}
</script>
