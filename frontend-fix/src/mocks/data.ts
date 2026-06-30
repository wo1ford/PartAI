/**
 * In-memory "БД" мок-слоя. Заполнена под reference/*.png.
 * Сервисы читают/мутируют эти структуры в рамках сессии.
 */
import type {
  Employee,
  FileItem,
  FolderItem,
  Office,
  Project,
  Task,
  TaskAssignee,
  UUID,
} from '@/shared/types'
import { addDays, startOfWeek } from '@/shared/lib/format'

interface RawTask extends Omit<Task, 'department' | 'project' | 'assignees'> {
  office_id: UUID
  department_id: UUID | null
  project_id: UUID | null
  assignee_ids: UUID[]
}

export const offices: Office[] = [
  { id: 'off-kazan', name: 'Офис Казань', city: 'Казань', timezone: 'Europe/Moscow' },
  { id: 'off-msk', name: 'Офис Москва', city: 'Москва', timezone: 'Europe/Moscow' },
]

interface DeptSeed {
  code: string
  name: string
  color: string
}

const DEPARTMENT_SEED: DeptSeed[] = [
  { code: 'event', name: 'Ивент', color: '#5FE0C2' },
  { code: 'media', name: 'Медиа', color: '#5B8DEF' },
  { code: 'primary', name: 'Первички', color: '#E86FA9' },
  { code: 'small_deeds', name: 'Малые Дела', color: '#4fc9b0' },
  { code: 'fields', name: 'Поля', color: '#F26D6D' },
  { code: 'observation', name: 'Наблюдение', color: '#8BD15B' },
  { code: 'office', name: 'Офис', color: '#F2994A' },
  { code: 'ecosphere', name: 'ЭкоСфера', color: '#9B8CFF' },
]

export interface DepartmentRow {
  id: UUID
  office_id: UUID
  code: string
  name: string
  color: string
}

export const departments: DepartmentRow[] = offices.flatMap((office) =>
  DEPARTMENT_SEED.map((d) => ({
    id: `dep-${office.id}-${d.code}`,
    office_id: office.id,
    code: d.code,
    name: d.name,
    color: d.color,
  })),
)

const depId = (officeId: UUID, code: string): UUID => `dep-${officeId}-${code}`

export const projects: Project[] = [
  { id: 'prj-2026', name: 'Программа 2026', description: 'Основная программа партии', status: 'active', starts_at: '2026-01-01', ends_at: '2026-12-31' },
  { id: 'prj-new', name: 'Жить по новому', description: 'Городские инициативы', status: 'active', starts_at: null, ends_at: null },
  { id: 'prj-probeg', name: 'Автопробег', description: 'Медиа-кампания', status: 'active', starts_at: null, ends_at: null },
  { id: 'prj-observe', name: 'Наблюдение 2026', description: 'Контроль выборов', status: 'active', starts_at: null, ends_at: null },
]

interface EmployeeSeed {
  id: UUID
  full_name: string
  email: string
  phone: string | null
  role: Employee['role']
  office_id: UUID
  is_online: boolean
  avatar_color: string
  dept_codes: string[]
}

const EMPLOYEE_SEED: EmployeeSeed[] = [
  { id: 'usr-admin', full_name: 'Админ Системы', email: 'admin@party.ru', phone: null, role: 'admin', office_id: 'off-kazan', is_online: true, avatar_color: '#2e3a4a', dept_codes: [] },
  { id: 'usr-yuri', full_name: 'Юрий Орлов', email: 'yuri@party.ru', phone: '+7 900 000-00-01', role: 'office_manager', office_id: 'off-kazan', is_online: true, avatar_color: '#5B8DEF', dept_codes: ['office', 'media'] },
  { id: 'usr-diana', full_name: 'Диана Нестерова', email: 'diana@party.ru', phone: '+7 900 000-00-02', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#5FE0C2', dept_codes: ['small_deeds'] },
  { id: 'usr-nastya', full_name: 'Анастасия Дьяконова', email: 'nastya@party.ru', phone: '+7 900 000-00-03', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#9B8CFF', dept_codes: ['media'] },
  { id: 'usr-lyaysan', full_name: 'Ляйсян Нуруллова', email: 'lyaysan@party.ru', phone: '+7 900 000-00-04', role: 'employee', office_id: 'off-kazan', is_online: false, avatar_color: '#F5D14E', dept_codes: ['office'] },
  { id: 'usr-sergey', full_name: 'Сергей Котов', email: 'sergey@party.ru', phone: '+7 900 000-00-05', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#8BD15B', dept_codes: ['fields'] },
  { id: 'usr-kamil', full_name: 'Камиль Ахметов', email: 'kamil@party.ru', phone: '+7 900 000-00-06', role: 'employee', office_id: 'off-kazan', is_online: false, avatar_color: '#F2994A', dept_codes: ['event'] },
  { id: 'usr-alina', full_name: 'Алина Сафина', email: 'alina@party.ru', phone: '+7 900 000-00-07', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#E86FA9', dept_codes: ['primary'] },
  { id: 'usr-rustam', full_name: 'Рустам Гали', email: 'rustam@party.ru', phone: '+7 900 000-00-08', role: 'employee', office_id: 'off-kazan', is_online: false, avatar_color: '#F26D6D', dept_codes: ['observation'] },
  { id: 'usr-vera', full_name: 'Вера Зайцева', email: 'vera@party.ru', phone: '+7 900 000-00-09', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#4fc9b0', dept_codes: ['ecosphere'] },
  { id: 'usr-oleg', full_name: 'Олег Дёмин', email: 'oleg@party.ru', phone: '+7 900 000-00-10', role: 'employee', office_id: 'off-kazan', is_online: true, avatar_color: '#5B8DEF', dept_codes: ['event', 'media'] },
  // Москва
  { id: 'usr-msk-1', full_name: 'Павел Орехов', email: 'pavel@party.ru', phone: '+7 900 111-00-01', role: 'office_manager', office_id: 'off-msk', is_online: true, avatar_color: '#5B8DEF', dept_codes: ['office'] },
  { id: 'usr-msk-2', full_name: 'Ирина Лосева', email: 'irina@party.ru', phone: '+7 900 111-00-02', role: 'employee', office_id: 'off-msk', is_online: false, avatar_color: '#E86FA9', dept_codes: ['media'] },
]

export interface EmployeeRow {
  id: UUID
  full_name: string
  email: string
  phone: string | null
  role: Employee['role']
  office_id: UUID
  is_online: boolean
  avatar_color: string
  department_ids: UUID[]
}

export const employees: EmployeeRow[] = EMPLOYEE_SEED.map((e) => ({
  id: e.id,
  full_name: e.full_name,
  email: e.email,
  phone: e.phone,
  role: e.role,
  office_id: e.office_id,
  is_online: e.is_online,
  avatar_color: e.avatar_color,
  department_ids: e.dept_codes.map((c) => depId(e.office_id, c)),
}))

// ---- Задачи: генерируем относительно текущей недели, чтобы календарь всегда был наполнен ----
const weekMonday = startOfWeek(new Date())

function at(dayOffset: number, h: number, m: number): string {
  const d = addDays(weekMonday, dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

interface TaskSeed {
  title: string
  day: number
  start: [number, number]
  end: [number, number]
  status: Task['status']
  priority: Task['priority']
  dept: string
  project: UUID | null
  assignees: UUID[]
  location?: string
  attachments?: number
  cover?: boolean
}

const TASK_SEED: TaskSeed[] = [
  { title: 'Закупка банеров', day: 0, start: [9, 0], end: [9, 40], status: 'planned', priority: 'medium', dept: 'media', project: 'prj-probeg', assignees: ['usr-nastya'], attachments: 1 },
  { title: 'Встреча', day: 0, start: [10, 30], end: [11, 0], status: 'in_progress', priority: 'low', dept: 'office', project: null, assignees: ['usr-yuri', 'usr-lyaysan'] },
  { title: 'Планерка офис', day: 0, start: [11, 0], end: [12, 0], status: 'planned', priority: 'medium', dept: 'office', project: null, assignees: ['usr-yuri', 'usr-diana', 'usr-oleg'], location: 'Малый зал', attachments: 1 },
  { title: 'Подача документов', day: 0, start: [13, 0], end: [13, 40], status: 'planned', priority: 'high', dept: 'office', project: 'prj-2026', assignees: ['usr-lyaysan'], attachments: 1 },
  { title: 'Онлайн Созвон', day: 1, start: [10, 0], end: [10, 45], status: 'in_progress', priority: 'medium', dept: 'media', project: null, assignees: ['usr-nastya', 'usr-oleg'] },
  { title: 'Результаты РосМол', day: 1, start: [11, 0], end: [11, 40], status: 'planned', priority: 'medium', dept: 'event', project: null, assignees: ['usr-kamil'] },
  { title: 'Согласование ролика Автопробега', day: 1, start: [12, 30], end: [13, 30], status: 'planned', priority: 'high', dept: 'media', project: 'prj-probeg', assignees: ['usr-nastya', 'usr-yuri'], attachments: 2, cover: true },
  { title: 'Обзвон базы', day: 2, start: [9, 30], end: [10, 30], status: 'in_progress', priority: 'medium', dept: 'small_deeds', project: null, assignees: ['usr-diana'] },
  { title: 'Полевой выход', day: 3, start: [14, 0], end: [15, 30], status: 'planned', priority: 'high', dept: 'fields', project: 'prj-new', assignees: ['usr-sergey', 'usr-alina'] },
  { title: 'Отчёт недели', day: 4, start: [12, 0], end: [13, 0], status: 'planned', priority: 'low', dept: 'office', project: null, assignees: ['usr-yuri'] },
  { title: 'Эко-акция', day: 2, start: [15, 0], end: [16, 0], status: 'done', priority: 'medium', dept: 'ecosphere', project: 'prj-new', assignees: ['usr-vera'] },
  // утро/вечер — чтобы показать полный день в календаре
  { title: 'Утренний брифинг', day: 0, start: [8, 0], end: [8, 30], status: 'planned', priority: 'low', dept: 'office', project: null, assignees: ['usr-yuri'] },
  { title: 'Раздача АПМ', day: 0, start: [16, 0], end: [18, 0], status: 'planned', priority: 'medium', dept: 'fields', project: 'prj-2026', assignees: ['usr-sergey', 'usr-alina'] },
  { title: 'Монтаж ролика', day: 1, start: [15, 0], end: [17, 30], status: 'in_progress', priority: 'medium', dept: 'media', project: 'prj-probeg', assignees: ['usr-nastya'], attachments: 3 },
  { title: 'Встреча с активом', day: 2, start: [18, 0], end: [19, 30], status: 'planned', priority: 'high', dept: 'primary', project: null, assignees: ['usr-alina', 'usr-yuri'], location: 'Штаб' },
  { title: 'Анализ соцсетей', day: 3, start: [9, 0], end: [10, 0], status: 'planned', priority: 'low', dept: 'media', project: null, assignees: ['usr-oleg'] },
  { title: 'Обучение наблюдателей', day: 3, start: [17, 0], end: [19, 0], status: 'planned', priority: 'high', dept: 'observation', project: 'prj-observe', assignees: ['usr-rustam'], attachments: 1 },
  { title: 'Координационный созвон', day: 4, start: [9, 30], end: [10, 15], status: 'planned', priority: 'medium', dept: 'office', project: null, assignees: ['usr-yuri', 'usr-oleg'] },
  { title: 'Подведение итогов', day: 4, start: [17, 0], end: [18, 0], status: 'planned', priority: 'medium', dept: 'office', project: 'prj-2026', assignees: ['usr-yuri', 'usr-diana', 'usr-nastya'] },
  { title: 'Субботник', day: 5, start: [11, 0], end: [14, 0], status: 'planned', priority: 'medium', dept: 'ecosphere', project: 'prj-new', assignees: ['usr-vera', 'usr-sergey'] },
]

export const tasks: RawTask[] = TASK_SEED.map((t, i) => ({
  id: `task-${i + 1}`,
  office_id: 'off-kazan',
  department_id: depId('off-kazan', t.dept),
  project_id: t.project,
  title: t.title,
  description: null,
  status: t.status,
  priority: t.priority,
  starts_at: at(t.day, t.start[0], t.start[1]),
  ends_at: at(t.day, t.end[0], t.end[1]),
  location: t.location ?? null,
  attachments_count: t.attachments ?? 0,
  cover_file_id: t.cover ? 'file-cover' : null,
  assignee_ids: t.assignees,
}))

// ---- Файлы / Папки ----
const ROOT_FOLDERS = [
  'Ивент', 'Медиа', 'Документы', 'АПМ', 'Claude База', 'Отчеты',
  'Программа 2026', 'Кандидаты', 'Бюджет', 'УИКи', 'Наблюдение', 'ЭкоСфера', 'Жить по новому',
]

export const folders: FolderItem[] = ROOT_FOLDERS.map((name, i) => ({
  id: `fld-${i + 1}`,
  name,
  parent_id: null,
  department_id: null,
}))

const mediaFolderId = folders.find((f) => f.name === 'Медиа')?.id ?? null

const MEDIA_SUBFOLDERS = ['Промо', 'ФотоБанк', 'Посты', 'Видео']
MEDIA_SUBFOLDERS.forEach((name, i) => {
  folders.push({ id: `fld-media-${i + 1}`, name, parent_id: mediaFolderId, department_id: depId('off-kazan', 'media') })
})

const docsFolderId = folders.find((f) => f.name === 'Документы')?.id ?? null
const DOCS_SUBFOLDERS = ['Заявления', 'Протоколы', 'Договоры']
DOCS_SUBFOLDERS.forEach((name, i) => {
  folders.push({ id: `fld-docs-${i + 1}`, name, parent_id: docsFolderId, department_id: null })
})

export interface FileRow extends FileItem {
  office_id: UUID
}

const fileAuthor = (id: UUID): { name: string; color: string } => {
  const e = employees.find((x) => x.id === id)
  return { name: e?.full_name ?? 'Сотрудник', color: e?.avatar_color ?? '#5B8DEF' }
}

function makeFile(
  id: UUID,
  name: string,
  mime: string,
  size: number,
  folderId: UUID | null,
  authorId: UUID,
  daysAgo: number,
  deptName: string | null,
): FileRow {
  const author = fileAuthor(authorId)
  const created = addDays(new Date(), -daysAgo)
  return {
    id,
    office_id: 'off-kazan',
    name,
    mime_type: mime,
    size_bytes: size,
    folder_id: folderId,
    department_id: null,
    department_name: deptName,
    storage_backend: 'local',
    uploaded_by: authorId,
    uploaded_by_name: author.name,
    uploaded_by_color: author.color,
    created_at: created.toISOString(),
  }
}

export const files: FileRow[] = [
  makeFile('file-1', 'автопробег.mp4', 'video/mp4', 48 * 1024 * 1024, mediaFolderId, 'usr-nastya', 1, 'Медиа'),
  makeFile('file-2', 'база-звонков.xlsx', 'application/vnd.ms-excel', 220 * 1024, null, 'usr-lyaysan', 1, 'Офис'),
  makeFile('file-3', 'заявление_обр.docx', 'application/msword', 64 * 1024, null, 'usr-diana', 2, 'Офис'),
  makeFile('file-4', 'Преза_вручение.pdf', 'application/pdf', 1.2 * 1024 * 1024, mediaFolderId, 'usr-nastya', 3, 'Медиа'),
  makeFile('file-5', 'Члены партии.xlsx', 'application/vnd.ms-excel', 540 * 1024, mediaFolderId, 'usr-yuri', 4, 'Медиа'),
  makeFile('file-6', 'общее_фото.jpg', 'image/jpeg', 3.4 * 1024 * 1024, mediaFolderId, 'usr-nastya', 4, 'Медиа'),
  makeFile('file-7', 'фото 4x3.png', 'image/png', 2.1 * 1024 * 1024, mediaFolderId, 'usr-oleg', 5, 'Медиа'),
  makeFile('file-8', 'Контент_план.docx', 'application/msword', 88 * 1024, mediaFolderId, 'usr-nastya', 5, 'Медиа'),
]

export function toTaskAssignee(id: UUID): TaskAssignee {
  const e = employees.find((x) => x.id === id)
  const name = e?.full_name ?? 'Сотрудник'
  return {
    id,
    full_name: name,
    initials: name.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toLocaleUpperCase('ru'),
    avatar_color: e?.avatar_color ?? '#5B8DEF',
  }
}
