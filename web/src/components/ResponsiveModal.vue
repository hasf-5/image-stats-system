<template>
  <!--
    一个组件两种形态，表单内容完全复用（slot 只渲染一份）：
    桌面端 el-dialog 居中 520px；移动端 el-drawer 底部抽屉，最大高 85vh 内部滚动
  -->
  <component
    :is="isMobile ? ElDrawer : ElDialog"
    v-model="visible"
    :title="title"
    v-bind="isMobile ? drawerProps : dialogProps"
    :close-on-click-modal="!loading"
    :show-close="true"
    append-to-body
    destroy-on-close
    class="responsive-modal"
  >
    <div class="modal-body">
      <slot />
    </div>

    <template v-if="showFooter" #footer>
      <div class="modal-footer" :class="isMobile ? 'pb-safe' : ''">
        <slot name="footer">
          <el-button :disabled="loading" @click="close">{{ cancelText }}</el-button>
          <el-button type="primary" :loading="loading" @click="$emit('confirm')">
            {{ confirmText }}
          </el-button>
        </slot>
      </div>
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElDialog, ElDrawer } from 'element-plus';
import { useIsMobile } from '@/utils/useIsMobile';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    width?: number;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    showFooter?: boolean;
    /** 移动端抽屉高度，默认 85% 视口 */
    mobileSize?: string;
  }>(),
  {
    title: '',
    width: 520,
    confirmText: '确定',
    cancelText: '取消',
    loading: false,
    showFooter: true,
    mobileSize: '85%',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'confirm'): void;
  (e: 'closed'): void;
}>();

const isMobile = useIsMobile();
const inner = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => (inner.value = v),
);

const visible = computed({
  get: () => inner.value,
  set: (v: boolean) => {
    inner.value = v;
    emit('update:modelValue', v);
  },
});

const dialogProps = computed(() => ({
  width: `${props.width}px`,
  // 垂直居中；长表单由 .modal-body 的 max-height 内部滚动兜底
  alignCenter: true,
}));

const drawerProps = computed(() => ({
  direction: 'btt' as const,
  size: props.mobileSize,
  withHeader: true,
  class: 'modal-drawer',
}));

function close() {
  visible.value = false;
}
</script>

<style scoped>
.modal-body {
  max-height: min(66vh, 640px);
  overflow-y: auto;
  padding-right: 2px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.modal-footer :deep(.el-button) {
  min-width: 88px;
}
/* 移动端：按钮撑满，方便拇指点击 */
@media (max-width: 768px) {
  .modal-body {
    max-height: none;
    padding-bottom: 4px;
  }
  .modal-footer {
    gap: 10px;
  }
  .modal-footer :deep(.el-button) {
    flex: 1;
    height: 46px;
    margin-left: 0;
  }
}
</style>

<style>
/* 移动端底部抽屉圆角与安全区 */
.modal-drawer {
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}
.modal-drawer .el-drawer__body {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
</style>
