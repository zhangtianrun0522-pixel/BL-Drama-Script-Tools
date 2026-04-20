import { computed } from 'vue'
import { useUserStore } from '~/stores/user'

export const useAuthHeaders = () => {
  const userStore = useUserStore()
  return computed(() => ({ Authorization: `Bearer ${userStore.token}` }))
}
