import type { DepartmentRef, Employee, EmployeeCreate, UUID } from '@/shared/types'
import { departments, employees, type EmployeeRow } from '@/mocks/data'
import { clone, delay, uid } from '@/mocks/util'
import { initials } from '@/shared/lib/format'

function deptRefs(ids: UUID[]): DepartmentRef[] {
  return ids
    .map((id) => departments.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((d) => ({ id: d.id, code: d.code, name: d.name, color: d.color }))
}

export function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    office_id: row.office_id,
    is_online: row.is_online,
    avatar_color: row.avatar_color,
    initials: initials(row.full_name),
    departments: deptRefs(row.department_ids),
  }
}

export interface EmployeeFilter {
  officeId: UUID
  departmentId?: UUID | null
  q?: string
}

export const EmployeeApi = {
  async list(filter: EmployeeFilter): Promise<Employee[]> {
    const q = (filter.q ?? '').trim().toLowerCase()
    const result = employees
      .filter((e) => e.office_id === filter.officeId)
      .filter((e) => (filter.departmentId ? e.department_ids.includes(filter.departmentId) : true))
      .filter((e) => (q ? `${e.full_name} ${e.email}`.toLowerCase().includes(q) : true))
      .map(toEmployee)
    return delay(clone(result))
  },

  async create(officeId: UUID, payload: EmployeeCreate): Promise<Employee> {
    const row: EmployeeRow = {
      id: uid('usr'),
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone ?? null,
      role: payload.role,
      office_id: officeId,
      is_online: false,
      avatar_color: '#5B8DEF',
      department_ids: [...payload.department_ids],
    }
    employees.push(row)
    return delay(clone(toEmployee(row)))
  },

  async update(id: UUID, payload: Partial<EmployeeCreate>): Promise<Employee> {
    const row = employees.find((e) => e.id === id)
    if (!row) throw new Error('Сотрудник не найден')
    if (payload.full_name !== undefined) row.full_name = payload.full_name
    if (payload.email !== undefined) row.email = payload.email
    if (payload.phone !== undefined) row.phone = payload.phone ?? null
    if (payload.role !== undefined) row.role = payload.role
    if (payload.department_ids !== undefined) row.department_ids = [...payload.department_ids]
    return delay(clone(toEmployee(row)))
  },

  async remove(id: UUID): Promise<void> {
    const idx = employees.findIndex((e) => e.id === id)
    if (idx >= 0) employees.splice(idx, 1)
    return delay(undefined)
  },
}
