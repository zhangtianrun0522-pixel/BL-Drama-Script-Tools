<template>
  <div class="auth-shell">
    <slot />
    <div class="toast-container">
      <div v-for="t in toastStore.toasts" :key="t.id" class="toast" :class="`toast-${t.type}`" @click="toastStore.remove(t.id)">
        <span>{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useToastStore } from '~/stores/toast'
const toastStore = useToastStore()
</script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
