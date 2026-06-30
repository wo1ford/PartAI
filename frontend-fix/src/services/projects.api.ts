import type { Project } from '@/shared/types'
import { projects } from '@/mocks/data'
import { clone, delay } from '@/mocks/util'

export const ProjectApi = {
  async list(): Promise<Project[]> {
    return delay(clone(projects))
  },
}
