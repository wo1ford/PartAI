import type { Department, DepartmentSummary, UUID } from '@/shared/types'
import { departments, employees, tasks, type DepartmentRow } from '@/mocks/data'
import { clone, delay, uid } from '@/mocks/util'
import { initials } from '@/shared/lib/format'
import { toEmployee } from './employees.api'

function buildDepartment(row: DepartmentRow): Department {
  const deptTasks = tasks.filter((t) => t.department_id === row.id)
  const deptEmployees = employees.filter((e) => e.department_ids.includes(row.id))
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    color: row.color,
    office_id: row.office_id,
    stats: {
      tasks_total: deptTasks.length,
      tasks_done: deptTasks.filter((t) => t.status === 'done').length,
      employees_count: deptEmployees.length,
    },
    employees_preview: deptEmployees.slice(0, 8).map((e) => ({
      id: e.id,
      initials: initials(e.full_name),
      avatar_color: e.avatar_color,
    })),
    tasks_preview: deptTasks.slice(0, 3).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
  }
}

export const DepartmentApi = {
  async list(officeId: UUID, q = ''): Promise<Department[]> {
    const query = q.trim().toLowerCase()
    const result = departments
      .filter((d) => d.office_id === officeId)
      .filter((d) => (query ? d.name.toLowerCase().includes(query) : true))
      .map(buildDepartment)
    return delay(clone(result))
  },

  async get(id: UUID): Promise<Department> {
    const row = departments.find((d) => d.id === id)
    if (!row) throw new Error('Отделение не найдено')
    return delay(clone(buildDepartment(row)))
  },

  async summary(id: UUID): Promise<DepartmentSummary> {
    const row = departments.find((d) => d.id === id)
    if (!row) throw new Error('Отделение не найдено')
    const deptTasks = tasks
      .filter((t) => t.department_id === id)
      .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }))
    const deptEmployees = employees
      .filter((e) => e.department_ids.includes(id))
      .map(toEmployee)
    return delay(clone({ department: buildDepartment(row), tasks: deptTasks, employees: deptEmployees }))
  },

  async create(officeId: UUID, name: string, color = '#5FE0C2'): Promise<Department> {
    const row: DepartmentRow = {
      id: uid('dep'),
      office_id: officeId,
      code: uid('code'),
      name,
      color,
    }
    departments.push(row)
    return delay(clone(buildDepartment(row)))
  },
}
