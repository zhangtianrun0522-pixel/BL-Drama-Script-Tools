import { useUserStore } from '~/stores/user'

export const useApi = () => {
  const userStore = useUserStore()
  const API_BASE = useRuntimeConfig().public.apiBase

  const request = async (url, options = {}) => {
    const token = userStore.token || ''
    const baseURL = options.baseURL || API_BASE
    try {
      return await $fetch(`${baseURL}${url}`, {
        method: options.method || 'GET',
        body: options.body,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })
    } catch (error) {
      const statusCode = error?.response?.status || error?.statusCode
      if (statusCode === 401 && import.meta.client) userStore.logout()
      const errorData = error?.response?._data || error?.data
      if (errorData?.message) throw new Error(errorData.message)
      throw new Error('网络请求失败，请稍后重试')
    }
  }

  const get  = (url, headers, baseURL) => request(url, { method: 'GET', headers, baseURL })
  const post = (url, body, headers, baseURL) => request(url, { method: 'POST', body, headers, baseURL })
  const put  = (url, body, baseURL) => request(url, { method: 'PUT', body, baseURL })
  const del  = (url, baseURL) => request(url, { method: 'DELETE', baseURL })

  return { request, get, post, put, del }
}
