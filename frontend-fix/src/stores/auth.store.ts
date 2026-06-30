import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthUser, UserRole } from '@/shared/types'
import { AuthApi } from '@/services/auth.api'

const SESSION_KEY = 'nph.session.userId'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const role = computed<UserRole | null>(() => user.value?.role ?? null)

  /** Эффективный офис: для admin берётся из office-стора (выбор в шапке). */
  function can(permission: string): boolean {
    const perms = user.value?.permissions ?? []
    return perms.includes('*') || perms.includes(permission)
  }

  function persist(id: string | null): void {
    if (id) localStorage.setItem(SESSION_KEY, id)
    else localStorage.removeItem(SESSION_KEY)
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true
    try {
      user.value = await AuthApi.login(email, password)
      persist(user.value.id)
    } finally {
      loading.value = false
    }
  }

  async function loginAs(r: UserRole): Promise<void> {
    loading.value = true
    try {
      user.value = await AuthApi.loginAs(r)
      persist(user.value.id)
    } finally {
      loading.value = false
    }
  }

  /** Восстановление сессии при загрузке (мок: по сохранённому id). */
  async function restore(): Promise<void> {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return
    try {
      user.value = await AuthApi.me(id)
    } catch {
      persist(null)
    }
  }

  async function logout(): Promise<void> {
    await AuthApi.logout()
    user.value = null
    persist(null)
  }

  return { user, loading, isAuthenticated, role, can, login, loginAs, restore, logout }
})
