<template>
  <ResponsiveModal
    v-model="visible"
    title="修改密码"
    :width="440"
    :loading="loading"
    confirm-text="确认修改"
    @confirm="onSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pt-1">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前密码" size="large" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password placeholder="8-32 位，含字母和数字" size="large" />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirm">
        <el-input v-model="form.confirm" type="password" show-password placeholder="再次输入新密码" size="large" />
      </el-form-item>
      <p class="text-xs text-slate-500 leading-5">修改成功后当前登录会失效，需要使用新密码重新登录。</p>
    </el-form>
  </ResponsiveModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import ResponsiveModal from '@/components/ResponsiveModal.vue';
import { apiChangePwd } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const router = useRouter();
const auth = useAuthStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' });

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/,
      message: '需 8-32 位，且同时包含字母和数字',
      trigger: 'blur',
    },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => (v === form.newPassword ? cb() : cb(new Error('两次输入的密码不一致'))),
      trigger: 'blur',
    },
  ],
};

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await apiChangePwd({ oldPassword: form.oldPassword, newPassword: form.newPassword });
    visible.value = false;
    ElMessage.success('密码已修改，请重新登录');
    auth.clear();
    await router.replace('/login');
  } catch (e: any) {
    ElMessage.error(e?.message || '修改失败');
  } finally {
    loading.value = false;
  }
}
</script>
