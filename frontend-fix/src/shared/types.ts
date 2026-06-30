/**
 * Контракты API v1 (источник истины — docs/IMPLEMENTATION.md §9–§10).
 * Единственное место для доменных типов фронта.
 */
export type UUID = string

export type UserRole = 'admin' | 'office_manager' | 'employee'
export type ProjectStatus = 'active' | 'archived'
export type MemberStatus = 'signed' | 'thinking' | 'unprocessed'
export type TaskStatus = 'planned' | 'in_progress' | 'done' | 'canceled'
export type TaskPriority = 'low' | 'medium' | 'high'
export type StorageBackend = 'local' | 's3'
export type Granularity = 'day' | 'month' | 'year'

export interface DepartmentRef {
  id: UUID
  code: string
  name: string
  color?: string
}

export interface Office {
  id: UUID
  name: string
  city: string
  timezone: string
}

export interface AuthUser {
  id: UUID
  full_name: string
  email: string
  role: UserRole
  office_id: UUID | null
  avatar_color: string
  initials: string
  departments: DepartmentRef[]
  permissions: string[]
}

export interface Employee {
  id: UUID
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  office_id: UUID
  is_online: boolean
  avatar_color: string
  initials: string
  departments: DepartmentRef[]
}

export interface DepartmentStats {
  tasks_total: number
  tasks_done: number
  employees_count: number
}

export interface DepartmentEmployeePreview {
  id: UUID
  initials: string
  avatar_color: string
}

export interface DepartmentSummaryTask {
  id: UUID
  title: string
  status: TaskStatus
  priority: TaskPriority
}

export interface Department {
  id: UUID
  code: string
  name: string
  color: string
  office_id: UUID
  stats: DepartmentStats
  employees_preview: DepartmentEmployeePreview[]
  tasks_preview: DepartmentSummaryTask[]
}

export interface DepartmentSummary {
  department: Department
  tasks: DepartmentSummaryTask[]
  employees: Employee[]
}

export interface Project {
  id: UUID
  name: string
  description: string | null
  status: ProjectStatus
  starts_at: string | null
  ends_at: string | null
}

export interface TaskAssignee {
  id: UUID
  full_name: string
  initials: string
  avatar_color: string
}

export interface TaskRef {
  id: UUID
  name: string
}

export interface Task {
  id: UUID
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  starts_at: string
  ends_at: string | null
  location: string | null
  department: TaskRef | null
  project: TaskRef | null
  assignees: TaskAssignee[]
  attachments_count: number
  cover_file_id: UUID | null
}

export interface TaskCreate {
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  department_id?: UUID | null
  project_id?: UUID | null
  priority: TaskPriority
  assignee_ids: UUID[]
  location?: string | null
}

export interface FolderItem {
  id: UUID
  name: string
  parent_id: UUID | null
  department_id: UUID | null
}

export interface FileItem {
  id: UUID
  name: string
  mime_type: string
  size_bytes: number
  folder_id: UUID | null
  department_id: UUID | null
  department_name: string | null
  storage_backend: StorageBackend
  uploaded_by: UUID
  uploaded_by_name: string
  uploaded_by_color: string
  created_at: string
}

export interface MemberSeriesPoint {
  bucket: string
  signed: number
  thinking: number
  unprocessed: number
}

export interface MemberStats {
  granularity: Granularity
  from: string
  to: string
  series: MemberSeriesPoint[]
}

export interface StatsSummary {
  members_total: number
  signed: number
  thinking: number
  unprocessed: number
  tasks_open: number
  tasks_done: number
}

export interface ChatMessage {
  id: UUID
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface EmployeeCreate {
  full_name: string
  email: string
  phone?: string | null
  role: UserRole
  department_ids: UUID[]
  password?: string
}
