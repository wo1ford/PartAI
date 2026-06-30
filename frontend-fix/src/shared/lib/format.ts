/** Утилиты форматирования: инициалы, цвета аватаров, даты, размер/тип файлов. */

const AVATAR_PALETTE = [
  '#5B8DEF',
  '#F5D14E',
  '#5FE0C2',
  '#9B8CFF',
  '#E86FA9',
  '#8BD15B',
  '#F26D6D',
  '#F2994A',
]

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''
  const a = first.charAt(0)
  const b = second.charAt(0) || first.charAt(1) || ''
  return (a + b).toLocaleUpperCase('ru')
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function avatarColor(seed: string): string {
  const idx = hash(seed) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx] ?? '#5B8DEF'
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const RU_WEEKDAYS_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

export function ruDayMonth(date: Date): string {
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`
}

export function ruWeekdayShort(date: Date): string {
  return RU_WEEKDAYS_SHORT[date.getDay()] ?? ''
}

export function ddmm(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}`
}

export function ddmmyyyy(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}.${m}.${date.getFullYear()}`
}

export function hhmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Понедельник недели, содержащей date (ISO — неделя с ПН). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // ПН=0 … ВС=6
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export type FileKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'video' | 'other'

export function fileKind(name: string): FileKind {
  const ext = fileExt(name)
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  return 'other'
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
