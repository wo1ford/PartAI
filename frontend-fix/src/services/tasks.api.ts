import type { Task, TaskCreate, TaskRef, TaskStatus, UUID } from '@/shared/types'
import { departments, projects, tasks, toTaskAssignee } from '@/mocks/data'
import { clone, delay, uid } from '@/mocks/util'

function deptRef(id: UUID | null): TaskRef | null {
  if (!id) return null
  const d = departments.find((x) => x.id === id)
  return d ? { id: d.id, name: d.name } : null
}

function projectRef(id: UUID | null): TaskRef | null {
  if (!id) return null
  const p = projects.find((x) => x.id === id)
  return p ? { id: p.id, name: p.name } : null
}

type RawTask = (typeof tasks)[number]

function buildTask(row: RawTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    location: row.location,
    department: deptRef(row.department_id),
    project: projectRef(row.project_id),
    assignees: row.assignee_ids.map(toTaskAssignee),
    attachments_count: row.attachments_count,
    cover_file_id: row.cover_file_id,
  }
}

export interface TaskFilter {
  officeId: UUID
  from?: string
  to?: string
  departmentId?: UUID | null
  projectId?: UUID | null
  assigneeId?: UUID | null
}

export const TaskApi = {
  async list(filter: TaskFilter): Promise<Task[]> {
    const fromTs = filter.from ? new Date(filter.from).getTime() : -Infinity
    const toTs = filter.to ? new Date(filter.to).getTime() : Infinity
    const result = tasks
      .filter((t) => t.office_id === filter.officeId)
      .filter((t) => {
        const ts = new Date(t.starts_at).getTime()
        return ts >= fromTs && ts <= toTs
      })
      .filter((t) => (filter.departmentId ? t.department_id === filter.departmentId : true))
      .filter((t) => (filter.projectId ? t.project_id === filter.projectId : true))
      .filter((t) => (filter.assigneeId ? t.assignee_ids.includes(filter.assigneeId) : true))
      .map(buildTask)
    return delay(clone(result))
  },

  async create(officeId: UUID, payload: TaskCreate): Promise<Task> {
    const row: RawTask = {
      id: uid('task'),
      office_id: officeId,
      department_id: payload.department_id ?? null,
      project_id: payload.project_id ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: 'planned',
      priority: payload.priority,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at ?? null,
      location: payload.location ?? null,
      attachments_count: 0,
      cover_file_id: null,
      assignee_ids: [...payload.assignee_ids],
    }
    tasks.push(row)
    return delay(clone(buildTask(row)))
  },

  async updateStatus(id: UUID, status: TaskStatus): Promise<Task> {
    const row = tasks.find((t) => t.id === id)
    if (!row) throw new Error('Задача не найдена')
    row.status = status
    return delay(clone(buildTask(row)))
  },

  /** Частичное обновление (используется drag-move / resize в календаре). */
  async update(
    id: UUID,
    payload: Partial<Pick<RawTask, 'starts_at' | 'ends_at' | 'title' | 'status' | 'priority' | 'department_id' | 'project_id'>>,
  ): Promise<Task> {
    const row = tasks.find((t) => t.id === id)
    if (!row) throw new Error('Задача не найдена')
    Object.assign(row, payload)
    return delay(clone(buildTask(row)))
  },

  async updateTime(id: UUID, startsAt: string, endsAt: string): Promise<Task> {
    return this.update(id, { starts_at: startsAt, ends_at: endsAt })
  },

  async remove(id: UUID): Promise<void> {
    const idx = tasks.findIndex((t) => t.id === id)
    if (idx >= 0) tasks.splice(idx, 1)
    return delay(undefined)
  },
}
