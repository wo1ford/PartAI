import type { AuthUser, DepartmentRef, UserRole } from '@/shared/types'
import { departments, employees, type EmployeeRow } from '@/mocks/data'
import { clone, delay } from '@/mocks/util'
import { initials } from '@/shared/lib/format'

const PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  office_manager: [
    'office:read', 'department:write', 'employee:write', 'task:write',
    'file:write', 'member:write', 'stats:office', 'settings:office',
  ],
  employee: ['task:status', 'file:upload', 'member:assigned', 'task:create:own'],
}

function deptRefs(row: EmployeeRow): DepartmentRef[] {
  return row.department_ids
    .map((id) => departments.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((d) => ({ id: d.id, code: d.code, name: d.name, color: d.color }))
}

export function toAuthUser(row: EmployeeRow): AuthUser {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    office_id: row.role === 'admin' ? null : row.office_id,
    avatar_color: row.avatar_color,
    initials: initials(row.full_name),
    departments: deptRefs(row),
    permissions: PERMISSIONS[row.role],
  }
}

const DEMO_BY_ROLE: Record<UserRole, string> = {
  admin: 'usr-admin',
  office_manager: 'usr-yuri',
  employee: 'usr-diana',
}

export const AuthApi = {
  /** Мок: пароль не проверяется. Пользователь ищется по email, иначе — менеджер. */
  async login(email: string, _password: string): Promise<AuthUser> {
    const row = employees.find((e) => e.email.toLowerCase() === email.trim().toLowerCase())
      ?? employees.find((e) => e.id === DEMO_BY_ROLE.office_manager)
    if (!row) throw new Error('Пользователь не найден')
    return delay(clone(toAuthUser(row)))
  },

  /** Демо-вход по роли (для быстрого показа RBAC). */
  async loginAs(role: UserRole): Promise<AuthUser> {
    const row = employees.find((e) => e.id === DEMO_BY_ROLE[role])
    if (!row) throw new Error('Демо-пользователь не найден')
    return delay(clone(toAuthUser(row)))
  },

  async me(userId: string): Promise<AuthUser> {
    const row = employees.find((e) => e.id === userId)
    if (!row) throw new Error('Сессия истекла')
    return delay(clone(toAuthUser(row)))
  },

  async logout(): Promise<void> {
    return delay(undefined)
  },
}
