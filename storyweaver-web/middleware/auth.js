import { useUserStore } from '~/stores/user'

export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const userStore = useUserStore()
  // Ensure store is initialized from localStorage on client
  if (import.meta.client && !userStore.isLoggedIn) {
    userStore.init()
  }
  if (!userStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
