<template>
  <div class="app-shell">
    <!-- 顶导航 -->
    <nav class="topnav">
      <div class="topnav-brand">
        <span class="brand-icon">✦</span>
        <span class="brand-name text-gradient">StoryWeaver</span>
      </div>
      <div class="topnav-links">
        <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">项目</NuxtLink>
        <NuxtLink to="/rules" class="nav-link" :class="{ active: route.path.startsWith('/rules') }">规则库</NuxtLink>
        <NuxtLink to="/experience" class="nav-link" :class="{ active: route.path.startsWith('/experience') }">经验库</NuxtLink>
      </div>
      <div class="topnav-right">
        <div v-if="userStore.isLoggedIn" class="user-menu" @click="showUserMenu = !showUserMenu">
          <div class="avatar">{{ userStore.userInfo?.nickname?.charAt(0) || 'U' }}</div>
          <span class="username">{{ userStore.userInfo?.nickname }}</span>
          <span class="badge badge-running" v-if="userStore.isAdmin" style="font-size:11px;padding:1px 6px;">管理员</span>

          <div v-if="showUserMenu" class="user-dropdown" @click.stop>
            <div class="dropdown-item" @click="handleLogout">退出登录</div>
          </div>
        </div>
      </div>
    </nav>

    <!-- 页面内容 -->
    <main class="app-main">
      <slot />
    </main>

    <!-- 全局 Toast -->
    <div class="toast-container">
      <div
        v-for="t in toastStore.toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.type}`"
        @click="toastStore.remove(t.id)"
      >
        <span>{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useUserStore } from '~/stores/user'
import { useToastStore } from '~/stores/toast'

const userStore = useUserStore()
const toastStore = useToastStore()
const route = useRoute()
const showUserMenu = ref(false)

// 点击外部关闭
onMounted(() => {
  document.addEventListener('click', () => { showUserMenu.value = false })
})

const handleLogout = () => {
  showUserMenu.value = false
  userStore.logout()
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

/* Top nav */
.topnav {
  height: var(--nav-height);
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 32px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.topnav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.brand-icon {
  font-size: 18px;
  background: var(--color-primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.topnav-links {
  display: flex;
  gap: 4px;
  flex: 1;
}

.nav-link {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all var(--transition);
  text-decoration: none;
}
.nav-link:hover, .nav-link.active {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.nav-link.active { color: var(--color-primary); }

.topnav-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
  position: relative;
}
.user-menu:hover { background: var(--color-bg-hover); }

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary-light);
  border: 1px solid rgba(139,92,246,0.4);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.username {
  font-size: 14px;
  color: var(--color-text);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  min-width: 120px;
  overflow: hidden;
  z-index: 200;
}
.dropdown-item {
  padding: 10px 14px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}
.dropdown-item:hover { background: var(--color-bg-hover); color: var(--color-danger); }

/* Main */
.app-main {
  flex: 1;
  padding: 28px 32px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
}
</style>
