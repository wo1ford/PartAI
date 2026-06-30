import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Office, UUID } from '@/shared/types'
import { OfficeApi } from '@/services/offices.api'
import { useAuthStore } from './auth.store'

/**
 * Активный офис. Для admin — выбирается в шапке (видит все офисы).
 * Для manager/employee жёстко = их office_id.
 */
export const useOfficeStore = defineStore('office', () => {
  const offices = ref<Office[]>([])
  const selectedId = ref<UUID | null>(null)

  const auth = useAuthStore()

  const activeOfficeId = computed<UUID | null>(() => {
    if (auth.user?.role === 'admin') return selectedId.value
    return auth.user?.office_id ?? null
  })

  const activeOffice = computed<Office | null>(
    () => offices.value.find((o) => o.id === activeOfficeId.value) ?? null,
  )

  const canSwitch = computed(() => auth.user?.role === 'admin')

  async function load(): Promise<void> {
    offices.value = await OfficeApi.list()
    if (!selectedId.value && offices.value.length > 0) {
      selectedId.value = offices.value[0]?.id ?? null
    }
  }

  function select(id: UUID): void {
    selectedId.value = id
  }

  return { offices, selectedId, activeOfficeId, activeOffice, canSwitch, load, select }
})
