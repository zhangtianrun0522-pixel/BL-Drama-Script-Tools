import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(null)
  const token = ref('')
  const apiBase = useRuntimeConfig().public.apiBase

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userInfo.value?.role === 'admin')

  const init = () => {
    if (!import.meta.client) return
    const savedToken = localStorage.getItem('sw_token')
    const savedUser  = localStorage.getItem('sw_user')
    if (savedToken) {
      if (_isExpired(savedToken)) { _clear(); return }
      token.value = savedToken
    }
    if (savedUser) {
      try { userInfo.value = JSON.parse(savedUser) } catch { userInfo.value = null }
    }
    if (token.value) fetchProfile()
  }

  const _isExpired = (jwt) => {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      return payload.exp ? payload.exp * 1000 < Date.now() - 30000 : false
    } catch { return true }
  }

  const _clear = () => {
    token.value = ''
    userInfo.value = null
    if (import.meta.client) {
      localStorage.removeItem('sw_token')
      localStorage.removeItem('sw_user')
    }
  }

  const fetchProfile = async () => {
    if (!token.value) return
    try {
      const res = await $fetch('/api/user/profile', {
        baseURL: apiBase,
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (res.code === 0 && res.data) {
        userInfo.value = res.data
        if (import.meta.client) localStorage.setItem('sw_user', JSON.stringify(res.data))
      }
    } catch { /* ignore */ }
  }

  const setLogin = (data) => {
    token.value = data.token
    userInfo.value = data.user
    if (import.meta.client) {
      localStorage.setItem('sw_token', data.token)
      localStorage.setItem('sw_user', JSON.stringify(data.user))
    }
  }

  const logout = () => {
    _clear()
    navigateTo('/login')
  }

  return { userInfo, token, isLoggedIn, isAdmin, init, fetchProfile, setLogin, logout }
})
