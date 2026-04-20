<template>
  <div class="login-wrap">
    <div class="login-box">
      <div class="login-brand">
        <span class="brand-icon">✦</span>
        <span class="text-gradient brand-title">StoryWeaver</span>
      </div>
      <p class="login-sub">BL短剧AI创作工作台</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="label">用户名</label>
          <input v-model="form.username" class="input" placeholder="请输入用户名" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label class="label">密码</label>
          <input v-model="form.password" class="input" type="password" placeholder="请输入密码" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:14px;height:14px;"></span>
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <p v-if="errMsg" class="err-msg">{{ errMsg }}</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'auth' })

import { useUserStore } from '~/stores/user'
const userStore = useUserStore()
const router = useRouter()

// 已登录则跳走
if (import.meta.client && userStore.isLoggedIn) {
  router.replace('/')
}

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const errMsg = ref('')
const apiBase = useRuntimeConfig().public.apiBase

const handleLogin = async () => {
  loading.value = true
  errMsg.value = ''
  try {
    const res = await $fetch('/api/auth/login', {
      baseURL: apiBase,
      method: 'POST',
      body: form,
    })
    if (res.code === 0) {
      userStore.setLogin({ token: res.data.token, user: res.data.userInfo })
      router.replace('/')
    } else {
      errMsg.value = res.message || '登录失败'
    }
  } catch (e) {
    errMsg.value = e?.data?.message || e.message || '网络错误'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.login-box {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 40px;
  box-shadow: var(--shadow-lg);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.brand-icon {
  font-size: 22px;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-title {
  font-size: 20px;
  font-weight: 700;
}

.login-sub {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-bottom: 28px;
}

.login-form { display: flex; flex-direction: column; gap: 0; }

.err-msg {
  margin-top: 12px;
  color: var(--color-danger);
  font-size: 13px;
  text-align: center;
}
</style>
