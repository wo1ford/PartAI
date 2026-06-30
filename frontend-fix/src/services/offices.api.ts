import type { Office } from '@/shared/types'
import { offices } from '@/mocks/data'
import { clone, delay } from '@/mocks/util'

export const OfficeApi = {
  async list(): Promise<Office[]> {
    return delay(clone(offices))
  },
  async get(id: string): Promise<Office> {
    const office = offices.find((o) => o.id === id)
    if (!office) throw new Error('Офис не найден')
    return delay(clone(office))
  },
}
