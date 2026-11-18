<template>
  <div class="min-h-screen-dvh flex flex-col md:flex-row bg-white">
    <!-- 品牌区：仅桌面端展示，移动端隐藏（同一套 DOM，不重复实现） -->
    <section
      class="hidden md:flex md:w-1/2 relative overflow-hidden bg-[#101a4a] text-white"
      aria-hidden="true"
    >
      <div class="absolute inset-0 bg-gradient-to-br from-[#0d1538] via-[#1b2a80] to-[#4158e8]"></div>
      <!-- 网格 -->
      <div
        class="absolute inset-0 opacity-[0.16]"
        style="
          background-image: linear-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.6) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at 30% 35%, #000 0%, transparent 72%);
        "
      ></div>
      <!-- 光斑 -->
      <div
        class="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full blur-3xl"
        style="background: radial-gradient(circle, rgba(120, 160, 255, 0.55), transparent 65%)"
      ></div>
      <div
        class="absolute bottom-[-140px] right-[-80px] w-[460px] h-[460px] rounded-full blur-3xl"
        style="background: radial-gradient(circle, rgba(96, 220, 255, 0.35), transparent 65%)"
      ></div>

      <div class="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
            <svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
              <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 20" stroke-linecap="round" />
            </svg>
          </div>
          <span class="text-[17px] font-semibold tracking-wide">图片提交与统计系统</span>
        </div>

        <div class="max-w-md">
          <h1 class="text-[34px] xl:text-[40px] font-bold leading-[1.25] tracking-tight">
            让每一次提交<br />都有迹可循
          </h1>
          <p class="mt-5 text-[15px] leading-7 text-white/70">
            手机拍照即传，后台按天 / 周 / 月自动汇总。<br />
            分类、记录、人员报表，一个系统全部搞定。
          </p>

          <ul class="mt-10 space-y-4 text-sm text-white/80">
            <li v-for="item in features" :key="item" class="flex items-center gap-3">
              <span class="w-6 h-6 rounded-full bg-white/12 ring-1 ring-white/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              {{ item }}
            </li>
          </ul>
        </div>

        <p class="text-xs text-white/40">内部系统 · 账号由管理员统一开通</p>
      </div>
    </section>

    <!-- 表单区 -->
    <section class="flex-1 flex flex-col justify-center items-center px-5 py-8 md:px-10 relative">
      <div class="w-full max-w-[400px]">
        <!-- 移动端品牌头 -->
        <div class="md:hidden flex flex-col items-center mb-8">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <svg viewBox="0 0 24 24" class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
              <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 20" stroke-linecap="round" />
            </svg>
          </div>
          <h2 class="mt-4 text-xl font-bold text-slate-900">图片提交与统计系统</h2>
          <p class="mt-1 text-sm text-slate-500">请使用管理员分配的账号登录</p>
        </div>

        <div class="hidden md:block mb-8">
          <h2 class="text-2xl font-bold text-slate-900">欢迎回来</h2>
          <p class="mt-2 text-sm text-slate-500">请使用管理员分配的账号登录</p>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="errorMsg"
          class="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
          role="alert"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" stroke-linecap="round" />
          </svg>
          <span class="leading-5">{{ errorMsg }}</span>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
          <el-form-item label="账号" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入账号"
              size="large"
              autocomplete="username"
              clearable
              @keyup.enter="onSubmit"
            >
              <template #prefix>
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4S18.3 16.4 19.5 20" stroke-linecap="round" />
                </svg>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              size="large"
              autocomplete="current-password"
              @keyup.enter="onSubmit"
            >
              <template #prefix>
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="4" y="10" width="16" height="10" rx="2.5" />
                  <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke-linecap="round" />
                </svg>
              </template>
              <template #suffix>
                <button
                  type="button"
                  class="w-7 h-7 -mr-1 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded tap"
                  :aria-label="showPwd ? '隐藏密码' : '显示密码'"
                  @click="showPwd = !showPwd"
                >
                  <svg v-if="!showPwd" viewBox="0 0 24 24" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.4 3.9M6.4 7.6A16.6 16.6 0 0 0 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 3.4-.6" stroke-linecap="round" />
                  </svg>
                </button>
              </template>
            </el-input>
          </el-form-item>

          <div class="flex items-center justify-between mt-1 mb-6">
            <el-checkbox v-model="remember" label="记住账号" />
            <button type="button" class="text-sm text-brand-600 hover:text-brand-700 font-medium tap" @click="onForgot">
              忘记密码？
            </button>
          </div>

          <el-button
            type="primary"
            class="w-full !h-12 !text-[15px] !font-semibold !rounded-lg"
            :loading="loading"
            native-type="submit"
            @click="onSubmit"
          >
            {{ loading ? '登录中…' : '登 录' }}
          </el-button>
        </el-form>

        <p class="mt-6 text-center text-xs leading-5 text-slate-400">
          本系统不开放注册，账号由管理员在后台创建
        </p>
      </div>

      <footer class="mt-10 md:mt-16 text-[11px] text-slate-400 pb-safe">
        © {{ year }} 图片提交与统计系统 · 内部使用
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const form = reactive({ username: '', password: '' });
const remember = ref(true);
const showPwd = ref(false);
const loading = ref(false);
const errorMsg = ref('');
const year = new Date().getFullYear();

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const features = ['手机拍照直传，自动压缩不占流量', '按天 / 周 / 月自动汇总统计', '分类、成员、报表一目了然'];

onMounted(() => {
  const saved = localStorage.getItem('imgstats.lastUsername');
  if (saved) {
    form.username = saved;
    remember.value = true;
  }
});

/** 忘记密码只弹提示，不做任何表单（账号只能由管理员创建/重置） */
function onForgot() {
  ElMessageBox.alert('账号由管理员创建，密码遗忘请联系管理员重置。', '忘记密码', {
    confirmButtonText: '我知道了',
    type: 'info',
    customClass: 'forgot-dialog',
  }).catch(() => void 0);
}

async function onSubmit() {
  if (loading.value) return;
  errorMsg.value = '';
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const user = await auth.login({ username: form.username.trim(), password: form.password });

    if (remember.value) localStorage.setItem('imgstats.lastUsername', user.username);
    else localStorage.removeItem('imgstats.lastUsername');

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    const fallback = user.role === 'admin' ? '/admin/dashboard' : '/user/upload';
    const target = redirect.startsWith('/') ? redirect : fallback;
    await router.replace(target);

    if (user.mustChangePwd) {
      ElMessage.warning('当前为初始密码，建议尽快在右上角菜单中修改');
    }
  } catch (e: any) {
    // 后端已做统一文案（账号或密码错误 / 锁定提示），直接透出
    errorMsg.value = e?.message || '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
:deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-size: 13px;
  color: #334155;
}
:deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 2px 12px;
  min-height: 46px;
}
:deep(.el-checkbox__label) {
  font-size: 13px;
  color: #475569;
}
</style>
