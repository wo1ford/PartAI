<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { Department, Employee, Project, Task, SubTask } from '@/shared/types'
import { TaskApi } from '@/services/tasks.api'
import { DepartmentApi } from '@/services/departments.api'
import { ProjectApi } from '@/services/projects.api'
import { EmployeeApi } from '@/services/employees.api'
import { useOfficeStore } from '@/stores/office.store'
import { addDays, ddmm, isSameDay, hhmm, ruDayMonth, startOfWeek } from '@/shared/lib/format'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import TaskFormDialog from '@/features/task/TaskFormDialog.vue'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import DatePicker from 'primevue/datepicker'

const office = useOfficeStore()
const toast = useToast()
const confirm = useConfirm()

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

type View = 'day' | 'week' | 'month'
const view = ref<View>('week')
const cursor = ref<Date>(new Date())
const tasks = ref<Task[]>([])
const departments = ref<Department[]>([])
const projects = ref<Project[]>([])
const employees = ref<Employee[]>([])
const createOpen = ref(false)
const editOpen = ref(false)
const editingTask = ref<Task | null>(null)
const selectedTaskId = ref<string | null>(null)
const prefillStart = ref<Date | null>(null)
const prefillEnd = ref<Date | null>(null)

const expandedMonthDays = ref<Set<string>>(new Set())

// ===== ЛОГИКА ВЫБОРА ДИАПАЗОНА =====
const rangePickerVisible = ref(false)
const dateRange = ref<Date[]>() 
const appliedDateRange = ref<Date[]>() 
const isRangeApplied = ref(false)

const isExact7Days = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) return false
  const start = dateRange.value[0]
  const end = dateRange.value[1]
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays === 6
})

const rangeLabel = computed(() => {
  if (isRangeApplied.value && appliedDateRange.value && appliedDateRange.value.length === 2) {
    const [start, end] = appliedDateRange.value
    const month = MONTHS[start.getMonth()]
    const startDay = start.getDate().toString().padStart(2, '0')
    const endDay = end.getDate().toString().padStart(2, '0')
    return `${month} [${startDay}–${endDay}]`
  }
  const start = cursor.value
  const end = addDays(start, 6)
  const month = MONTHS[start.getMonth()]
  const startDay = start.getDate().toString().padStart(2, '0')
  const endDay = end.getDate().toString().padStart(2, '0')
  return `${month} [${startDay}–${endDay}]`
})

const viewTabs: { label: string; value: View }[] = [
  { label: 'День', value: 'day' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
]

const weekStart = computed(() => {
  if (isRangeApplied.value && appliedDateRange.value && appliedDateRange.value.length === 2) {
    return new Date(appliedDateRange.value[0])
  }
  return new Date(cursor.value)
})

const days = computed<Date[]>(() => {
  if (view.value === 'day') return [new Date(cursor.value)]
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart.value, i))
})

const baseWeekdayNames = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
const displayWeekdayNames = computed(() => {
  if (view.value === 'week') {
    const firstDayIndex = days.value[0].getDay()
    return baseWeekdayNames.slice(firstDayIndex).concat(baseWeekdayNames.slice(0, firstDayIndex))
  }
  return baseWeekdayNames
})

// ===== ДИНАМИЧЕСКАЯ ВЫСОТА ЧАСА =====
const hourHeight = computed(() => {
  if (!tasks.value.length) return 80
  let maxDuration = 0
  tasks.value.forEach(task => {
    const start = new Date(task.starts_at)
    const end = task.ends_at ? new Date(task.ends_at) : new Date(start.getTime() + 60 * 60 * 1000)
    const duration = (end.getTime() - start.getTime()) / (1000 * 60)
    if (duration > maxDuration) maxDuration = duration
  })
  const baseHourHeight = 80
  const requiredHeightForMaxTask = (maxDuration / 60) * baseHourHeight * 1.2
  const calculatedHourHeight = Math.max(baseHourHeight, requiredHeightForMaxTask / 11)
  return Math.min(Math.max(Math.ceil(calculatedHourHeight), 80), 180)
})

const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8:00 - 19:00

const getTaskPosition = (task: Task, dayIdx: number) => {
  const start = new Date(task.starts_at)
  const minutesFrom8 = (start.getHours() - 8) * 60 + start.getMinutes()
  const topPx = (minutesFrom8 / 60) * hourHeight.value
  return {
    top: topPx + 44 + 'px',
    left: (dayIdx * 14.28) + 2 + '%',
    width: 'calc(14.28% - 28px)',
    startTime: start,
    endTime: new Date(task.ends_at || start.getTime() + 60 * 60 * 1000)
  }
}

const now = ref(new Date())
let interval: ReturnType<typeof setInterval>

// ===== АВТОМАТИЧЕСКИЙ ПЕРЕНОС ПРОСРОЧЕННЫХ ЗАДАЧ =====
async function checkAndPostponeOverdueTasks(): Promise<void> {
  const nowDate = new Date()
  let needReload = false

  for (const task of tasks.value) {
    // Если задача уже сделана или не имеет даты окончания - пропускаем
    if (task.status === 'done' || !task.ends_at) continue

    const endDate = new Date(task.ends_at)
    // Если дата окончания меньше текущей даты (просрочена)
    if (endDate < nowDate) {
      const oldStart = new Date(task.starts_at)
      const oldEnd = new Date(task.ends_at)

      const newStart = addDays(oldStart, 1)
      const newEnd = addDays(oldEnd, 1)

      // Эмуляция обновления через API
      await TaskApi.updateTime(task.id, newStart.toISOString(), newEnd.toISOString())
      
      // Помечаем задачу как просроченную (флаг для UI)
      task.is_overdue = true
      // Обновляем локальные даты
      task.starts_at = newStart.toISOString()
      task.ends_at = newEnd.toISOString()

      needReload = true
      toast.add({
        severity: 'warn',
        summary: 'Задача просрочена',
        detail: `"${task.title}" автоматически перенесена на завтра`,
        life: 3000
      })
    }
  }

  if (needReload) {
    // Перезагружаем, чтобы синхронизировать с бэкендом
    await load()
  }
}

onMounted(() => {
  interval = setInterval(() => { 
    now.value = new Date()
    checkAndPostponeOverdueTasks() // Проверка каждую минуту
  }, 60000)
})
onUnmounted(() => clearInterval(interval))

const currentTimeLineStyle = computed(() => {
  const minutesFrom8 = (now.value.getHours() - 8) * 60 + now.value.getMinutes()
  const top = (minutesFrom8 / 60) * hourHeight.value + 44
  return { top: `${top}px` }
})

// ===== МЕСЯЦ =====
const monthCells = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i)
    const dayTasks = tasks.value.filter((t) => isSameDay(new Date(t.starts_at), date))
    return { date, inMonth: date.getMonth() === cursor.value.getMonth(), tasks: dayTasks }
  })
})

function toggleMonthDayExpand(date: Date): void {
  const key = date.toISOString()
  if (expandedMonthDays.value.has(key)) {
    expandedMonthDays.value.delete(key)
  } else {
    expandedMonthDays.value.add(key)
  }
}

function isMonthDayExpanded(date: Date): boolean {
  return expandedMonthDays.value.has(date.toISOString())
}

// ===== ЗАГРУЗКА =====
async function load(): Promise<void> {
  if (!office.activeOfficeId) return
  let from: Date, to: Date
  if (view.value === 'day') {
    from = new Date(cursor.value); from.setHours(0, 0, 0, 0)
    to = addDays(from, 1)
  } else if (view.value === 'week') {
    from = weekStart.value
    to = addDays(weekStart.value, 7)
  } else {
    const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
    from = startOfWeek(first)
    to = addDays(from, 42)
  }
  tasks.value = await TaskApi.list({ officeId: office.activeOfficeId, from: from.toISOString(), to: to.toISOString() })
}

async function loadLists(): Promise<void> {
  if (!office.activeOfficeId) return
  const [deps, prjs, emps] = await Promise.all([
    DepartmentApi.list(office.activeOfficeId),
    ProjectApi.list(),
    EmployeeApi.list({ officeId: office.activeOfficeId }),
  ])
  departments.value = deps
  projects.value = prjs
  employees.value = emps
}

function shift(dir: number): void {
  if (view.value === 'day') {
    cursor.value = addDays(cursor.value, dir)
  } else if (view.value === 'week') {
    cursor.value = addDays(cursor.value, dir * 7)
  } else {
    cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + dir, 1)
  }
}

function today(): void {
  isRangeApplied.value = false
  appliedDateRange.value = undefined
  dateRange.value = undefined
  cursor.value = new Date()
  rangePickerVisible.value = false
  load()
}

function applyRange(): void {
  if (dateRange.value && dateRange.value.length === 2 && isExact7Days.value) {
    appliedDateRange.value = [...dateRange.value]
    isRangeApplied.value = true
    cursor.value = new Date(dateRange.value[0])
    rangePickerVisible.value = false
    load()
  }
}

function cancelRange(): void {
  isRangeApplied.value = false
  appliedDateRange.value = undefined
  dateRange.value = undefined
  cursor.value = new Date()
  rangePickerVisible.value = false
  load()
}

function openCreate(): void {
  prefillStart.value = null
  prefillEnd.value = null
  createOpen.value = true
}

function onCreateRange(payload: { starts_at: string; ends_at: string }): void {
  prefillStart.value = new Date(payload.starts_at)
  prefillEnd.value = new Date(payload.ends_at)
  createOpen.value = true
}

async function onMove(payload: { id: string; starts_at: string; ends_at: string }): Promise<void> {
  await TaskApi.updateTime(payload.id, payload.starts_at, payload.ends_at)
  toast.add({ severity: 'success', summary: 'Время задачи обновлено', life: 1600 })
  await load()
}

function openEdit(task: Task): void {
  editingTask.value = task
  editOpen.value = true
}

// ===== УДАЛЕНИЕ ЗАДАЧИ =====
function confirmDeleteTask(taskId: string): void {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  confirm.require({
    message: `Вы уверены, что хотите удалить задачу «${task.title}»?`,
    header: 'Удаление задачи',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300))
        const idx = tasks.value.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          tasks.value.splice(idx, 1)
        }
        selectedTaskId.value = null
        toast.add({ severity: 'success', summary: 'Задача удалена', detail: task.title, life: 2500 })
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось удалить задачу', life: 3000 })
      }
    }
  })
}

// ===== СТАТУСЫ =====
const statusOptions = [
  { label: 'Запланировано', value: 'planned', color: '#90caf9' },
  { label: 'В процессе', value: 'in_progress', color: '#ffb74d' },
  { label: 'Сделано', value: 'done', color: '#81c784' },
]

async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const taskIndex = tasks.value.findIndex(t => t.id === taskId)
  if (taskIndex === -1) return

  const oldStatus = tasks.value[taskIndex].status
  tasks.value[taskIndex].status = status as any

  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    toast.add({
      severity: 'success',
      summary: 'Статус обновлён',
      detail: `Задача переведена в статус «${statusOptions.find(s => s.value === status)?.label}»`,
      life: 2000
    })
  } catch (error) {
    tasks.value[taskIndex].status = oldStatus
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось обновить статус задачи',
      life: 3000
    })
  }
}

// ===== ПОДЗАДАЧИ (С флажками как у основной задачи) =====
const subtaskStatusOptions = [
  { label: 'К выполнению', value: 'todo', color: '#94a3b8' },
  { label: 'В процессе', value: 'in_progress', color: '#fbbf24' },
  { label: 'Сделано', value: 'done', color: '#34d399' },
]

const newSubtaskText = ref('')
const localSubtasks = ref<SubTask[]>([])

function addSubtask(): void {
  const text = newSubtaskText.value.trim()
  if (!text) return
  localSubtasks.value.push({
    id: Date.now().toString(),
    text,
    status: 'todo',
    task_id: selectedTaskId.value || ''
  })
  newSubtaskText.value = ''
}

function updateSubtaskStatus(sub: SubTask, status: string): void {
  sub.status = status
}

async function saveSubtasks(taskId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200))
  toast.add({
    severity: 'success',
    summary: 'Подзадачи сохранены',
    life: 1500
  })
}

// ===== ПЕРЕНОС ЗАДАЧИ НА ЗАВТРА И ОБРАТНО =====
async function postponeTask(taskId: string): Promise<void> {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  const oldStart = new Date(task.starts_at)
  const oldEnd = task.ends_at ? new Date(task.ends_at) : new Date(oldStart.getTime() + 60 * 60 * 1000)

  const newStart = addDays(oldStart, 1)
  const newEnd = addDays(oldEnd, 1)

  await TaskApi.updateTime(taskId, newStart.toISOString(), newEnd.toISOString())
  
  toast.add({
    severity: 'info',
    summary: 'Перенесено',
    detail: 'Задача перенесена на следующий день',
    life: 2000
  })
  
  selectedTaskId.value = null
  await load()
}

async function revertPostponeTask(taskId: string): Promise<void> {
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  const oldStart = new Date(task.starts_at)
  const oldEnd = task.ends_at ? new Date(task.ends_at) : new Date(oldStart.getTime() + 60 * 60 * 1000)

  const newStart = addDays(oldStart, -1)
  const newEnd = addDays(oldEnd, -1)

  await TaskApi.updateTime(taskId, newStart.toISOString(), newEnd.toISOString())
  
  toast.add({
    severity: 'info',
    summary: 'Возвращено',
    detail: 'Задача возвращена на исходную дату',
    life: 2000
  })
  
  // Сбрасываем флаг просроченности
  task.is_overdue = false
  
  selectedTaskId.value = null
  await load()
}

watch([view, cursor, () => office.activeOfficeId], load)
onMounted(async () => { await Promise.all([load(), loadLists()]) })
</script>

<template>
  <div class="calendar">
    <div class="calendar__head">
      <h1>Календарь</h1>
      <div class="grow" />
      <Button label="Создать" icon="pi pi-plus" @click="openCreate" />
      <Button icon="pi pi-refresh" rounded text aria-label="Обновить" @click="load" />
    </div>

    <div class="calendar__controls">
      <div class="nav">
        <Button icon="pi pi-chevron-left" rounded text @click="shift(-1)" />
        
        <div class="range-picker-wrapper">
          <Button 
            class="range-picker-trigger" 
            :label="rangeLabel"
            @click="rangePickerVisible = !rangePickerVisible"
          />
          
          <div v-show="rangePickerVisible" class="range-picker-dropdown-container" @click.stop>
            <Button 
              icon="pi pi-times" 
              text 
              class="range-picker-close-btn" 
              @click="rangePickerVisible = false"
            />
            
            <DatePicker
              v-model="dateRange"
              v-model:visible="rangePickerVisible"
              selection-mode="range"
              :manual-input="false"
              date-format="dd.mm.yy"
              class="range-picker-dropdown"
              :inline="true"
              :show-button-bar="false"
              @date-select="(newDates) => {
                if (newDates && Array.isArray(newDates)) {
                  if (newDates.length === 1) {
                    const start = newDates[0]
                    const end = addDays(start, 6)
                    dateRange.value = [start, end]
                  } else if (newDates.length === 2) {
                    const start = newDates[0]
                    const end = addDays(start, 6)
                    dateRange.value = [start, end]
                  }
                }
              }"
            />
            
            <div class="range-picker-actions">
              <Button 
                class="range-apply-btn"
                label="Применить"
                :disabled="!isExact7Days"
                @click="applyRange"
              />
            </div>
          </div>
        </div>

        <Button icon="pi pi-chevron-right" rounded text @click="shift(1)" />
      </div>
      
      <div class="grow" />
      
      <Button 
        v-if="isRangeApplied"
        class="cancel-range-btn"
        label="× Отменить"
        severity="danger"
        outlined
        size="small"
        @click="cancelRange"
      />
      
      <Button label="Сегодня" outlined size="small" @click="today" />
      <SegmentedTabs v-model="view" :options="viewTabs" />
    </div>

    <!-- ===== ВИД: ДЕНЬ ===== -->
    <div v-if="view === 'day'" class="day-container">
      <div class="day-header">
        <span class="day-header__title">{{ ruDayMonth(cursor) }}</span>
      </div>
      <div class="day-body">
        <div class="day-body__times">
          <div v-for="h in hours" :key="h" class="day-body__hour">{{ h.toString().padStart(2, '0') }}:00</div>
        </div>
        <div class="day-body__tasks-wrapper">
          <div class="current-time-line" :style="currentTimeLineStyle"></div>
          <div 
            v-for="task in tasks" 
            :key="task.id"
            class="day-task"
            :style="{ 
              top: getTaskPosition(task, 0).top, 
              left: '2%', 
              width: '96%' 
            }"
            @click="selectedTaskId = task.id"
          >
            <div class="day-task__time">
              <span class="day-task__start">{{ hhmm(getTaskPosition(task, 0).startTime) }}</span>
              <span class="day-task__separator">–</span>
              <span class="day-task__end">{{ hhmm(getTaskPosition(task, 0).endTime) }}</span>
            </div>
            <div class="day-task__main">
              <div class="day-task__title-row">
                <i class="pi pi-calendar day-task__icon" />
                <span class="day-task__title">{{ task.title }}</span>
                <i class="pi pi-ellipsis-v day-task__menu" @click.stop="openEdit(task)" />
              </div>
              <div class="day-task__badges">
                <span class="badge badge--status" :class="'badge--' + task.status">
                  {{ task.status === 'done' ? 'Сделано' : task.status === 'in_progress' ? 'В процессе' : 'Запланировано' }}
                </span>
                <span class="badge badge--priority" :class="'badge--' + task.priority">
                  {{ task.priority === 'high' ? 'Срочно' : task.priority === 'medium' ? 'Средне' : 'Низко' }}
                </span>
                <!-- Бейдж просрочено -->
                <span v-if="task.is_overdue" class="badge badge--overdue">Просрочено</span>
              </div>
              <div v-if="task.attachments && task.attachments.length > 0" class="day-task__previews">
                <div v-for="att in task.attachments.slice(0, 3)" :key="att.id" class="preview-item">
                  <img v-if="att.type.startsWith('image')" :src="att.url" alt="preview" />
                  <video v-else-if="att.type.startsWith('video')" :src="att.url" muted loop />
                  <i v-else class="pi pi-file" />
                </div>
              </div>
              <div v-if="task.assignees && task.assignees.length > 0" class="day-task__avatars">
                <HexAvatar v-for="a in task.assignees.slice(0, 4)" :key="a.id" :initials="a.initials" :color="a.avatar_color" :size="24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== ВИД: НЕДЕЛЯ ===== -->
    <div v-else-if="view === 'week'" class="week-container">
      <div class="week-header">
        <div class="week-header__time-placeholder"></div>
        <div 
          v-for="(day, idx) in days" 
          :key="day.toISOString()" 
          class="week-header__day"
          :class="{ 'is-today': isSameDay(day, new Date()) }"
        >
          <span class="week-header__day-name">{{ displayWeekdayNames[idx] }}</span>
          <span class="week-header__day-number">{{ day.getDate() }}</span>
        </div>
      </div>
      <div class="week-body">
        <div class="week-body__times">
          <div v-for="h in hours" :key="h" class="week-body__hour">{{ h.toString().padStart(2, '0') }}:00</div>
        </div>
        <div class="week-body__tasks">
          <div class="current-time-line" :style="currentTimeLineStyle"></div>
          <div 
            v-for="task in tasks" 
            :key="task.id"
            class="task-card"
            :style="getTaskPosition(task, days.findIndex(d => isSameDay(d, new Date(task.starts_at))))"
            @click="selectedTaskId = task.id"
          >
            <div class="task-card__header">
              <div class="task-card__title-row">
                <i class="pi pi-calendar" />
                <span class="task-card__title">{{ task.title }}</span>
              </div>
              <i class="pi pi-ellipsis-v task-card__menu" @click.stop="openEdit(task)" />
            </div>
            <div class="task-card__time">
              {{ hhmm(getTaskPosition(task, 0).startTime) }} – {{ hhmm(getTaskPosition(task, 0).endTime) }}
            </div>
            <div class="task-card__badges">
              <span class="badge badge--status" :class="'badge--' + task.status">
                {{ task.status === 'done' ? 'Сделано' : task.status === 'in_progress' ? 'В процессе' : 'Запланировано' }}
              </span>
              <span class="badge badge--priority" :class="'badge--' + task.priority">
                {{ task.priority === 'high' ? 'Срочно' : task.priority === 'medium' ? 'Средне' : 'Низко' }}
              </span>
              <span v-if="task.is_overdue" class="badge badge--overdue">Просрочено</span>
            </div>
            <div v-if="task.attachments && task.attachments.length > 0" class="task-card__previews">
              <div v-for="att in task.attachments.slice(0, 2)" :key="att.id" class="preview-item">
                <img v-if="att.type.startsWith('image')" :src="att.url" alt="preview" />
                <video v-else-if="att.type.startsWith('video')" :src="att.url" muted loop />
                <i v-else class="pi pi-file" />
              </div>
            </div>
            <div v-if="task.assignees && task.assignees.length > 0" class="task-card__avatars">
              <HexAvatar v-for="a in task.assignees.slice(0, 4)" :key="a.id" :initials="a.initials" :color="a.avatar_color" :size="24" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== ВИД: МЕСЯЦ ===== -->
    <div v-else class="month surface-card">
      <div class="month__head">
        <span v-for="d in weekdayNames" :key="d">{{ d }}</span>
      </div>
      <div class="month__grid">
        <div
          v-for="cell in monthCells"
          :key="cell.date.toISOString()"
          class="month__cell"
          :class="{ 'is-out': !cell.inMonth, 'is-today': isSameDay(cell.date, new Date()) }"
        >
          <span class="month__num">{{ cell.date.getDate() }}</span>
          <template v-for="(t, idx) in cell.tasks" :key="t.id">
            <button
              v-if="idx < 3 || isMonthDayExpanded(cell.date)"
              class="month__chip"
              :class="{ 'is-high': t.priority === 'high', 'is-overdue': t.is_overdue }"
              type="button"
              @click="selectedTaskId = t.id"
            >{{ hhmm(new Date(t.starts_at)) }} {{ t.title }}</button>
          </template>
          <span 
            v-if="cell.tasks.length > 3 && !isMonthDayExpanded(cell.date)" 
            class="month__more" 
            @click="toggleMonthDayExpand(cell.date)"
          >+{{ cell.tasks.length - 3 }}</span>
          <span 
            v-else-if="cell.tasks.length > 3 && isMonthDayExpanded(cell.date)" 
            class="month__more" 
            @click="toggleMonthDayExpand(cell.date)"
          >Свернуть</span>
        </div>
      </div>
    </div>

    <TaskFormDialog
      v-if="office.activeOfficeId"
      v-model:visible="createOpen"
      :office-id="office.activeOfficeId"
      :departments="departments"
      :projects="projects"
      :employees="employees"
      :prefill-start="prefillStart"
      :prefill-end="prefillEnd"
      @created="load"
    />

    <TaskFormDialog
      v-if="office.activeOfficeId && editingTask"
      v-model:visible="editOpen"
      :office-id="office.activeOfficeId"
      :departments="departments"
      :projects="projects"
      :employees="employees"
      :task="editingTask"
      @created="load"
      @updated="load"
    />

    <!-- ===== ДИАЛОГ: Детали задачи ===== -->
    <Dialog
      :visible="selectedTaskId !== null"
      modal
      :style="{ width: '520px' }"
      @update:visible="(val) => { if (!val) selectedTaskId = null }"
    >
      <!-- Кастомный заголовок с прогрессом -->
      <template #header>
        <div class="dialog-header-custom">
          <div class="dialog-header-title">
            {{ tasks.find(t => t.id === selectedTaskId)?.title }}
          </div>
          <div 
            v-if="localSubtasks.length > 0" 
            class="dialog-header-progress"
          >
            <div class="circular-progress-container">
              <div class="circular-progress" :style="{ 
                '--progress': (localSubtasks.filter(s => s.status === 'done').length / localSubtasks.length) * 100 + '%'
              }"></div>
              <span class="circular-progress-text">
                {{ Math.round((localSubtasks.filter(s => s.status === 'done').length / localSubtasks.length) * 100) }}%
              </span>
            </div>
          </div>
        </div>
      </template>

      <div v-if="selectedTaskId" class="task-detail">
        <template v-for="task in tasks.filter(t => t.id === selectedTaskId)" :key="task.id">
          <div class="task-detail__row"><i class="pi pi-clock" /><span>{{ hhmm(new Date(task.starts_at)) }}<template v-if="task.ends_at"> – {{ hhmm(new Date(task.ends_at)) }}</template> <span v-if="task.is_overdue" class="overdue-label">(Просрочено)</span></span></div>
          <div v-if="task.department" class="task-detail__row"><i class="pi pi-th-large" /><span>{{ task.department.name }}</span></div>
          <div v-if="task.project" class="task-detail__row"><i class="pi pi-briefcase" /><span>{{ task.project.name }}</span></div>
          <div v-if="task.location" class="task-detail__row"><i class="pi pi-map-marker" /><span>{{ task.location }}</span></div>
          <div class="task-detail__row"><i class="pi pi-flag" /><StatusTag :status="task.status" /><StatusTag :priority="task.priority" /></div>
          <div v-if="task.assignees.length" class="task-detail__people">
            <HexAvatar v-for="a in task.assignees" :key="a.id" :initials="a.initials" :color="a.avatar_color" :size="30" />
          </div>

          <!-- ===== ПЕРЕКЛЮЧАТЕЛИ СТАТУСА ===== -->
          <div class="task-status-selector">
            <div class="status-label">Статус задачи</div>
            <div class="status-options">
              <div 
                v-for="opt in statusOptions" 
                :key="opt.value"
                class="status-chip"
                :class="{ 'status-chip--active': task.status === opt.value }"
                @click="updateTaskStatus(task.id, opt.value)"
              >
                <span class="status-dot" :style="{ backgroundColor: opt.color }" />
                {{ opt.label }}
              </div>
            </div>
          </div>

          <!-- ===== ПОДЗАДАЧИ (С флажками как у задачи + прогресс-бар) ===== -->
          <div class="subtasks-section">
            <div class="status-label">
              Подзадачи
              <span v-if="localSubtasks.length > 0" class="subtask-progress-label">
                ({{ localSubtasks.filter(s => s.status === 'done').length }}/{{ localSubtasks.length }})
              </span>
            </div>
            
            <!-- Линейный прогресс-бар -->
            <div v-if="localSubtasks.length > 0" class="subtask-progress-bar">
              <div 
                class="subtask-progress-fill" 
                :style="{ width: (localSubtasks.filter(s => s.status === 'done').length / localSubtasks.length) * 100 + '%' }"
              ></div>
            </div>

            <div class="subtask-list">
              <div 
                v-for="sub in localSubtasks" 
                :key="sub.id" 
                class="subtask-row"
              >
                <div class="subtask-status-options">
                  <div 
                    v-for="opt in subtaskStatusOptions" 
                    :key="opt.value"
                    class="status-chip subtask-chip"
                    :class="{ 'status-chip--active': sub.status === opt.value }"
                    @click="updateSubtaskStatus(sub, opt.value)"
                  >
                    <span class="status-dot" :style="{ backgroundColor: opt.color }" />
                    {{ opt.label }}
                  </div>
                </div>
                <span class="subtask-text" :class="{ 'subtask-text--done': sub.status === 'done' }">
                  {{ sub.text }}
                </span>
              </div>
            </div>
            
            <div class="subtask-input-row">
              <InputText 
                v-model="newSubtaskText" 
                placeholder="Новая подзадача..." 
                class="subtask-input" 
                fluid
                @keyup.enter="addSubtask"
              />
              <Button 
                icon="pi pi-plus" 
                rounded 
                text 
                severity="secondary" 
                @click="addSubtask" 
                :disabled="!newSubtaskText.trim()"
              />
            </div>
            <div class="subtask-actions">
              <Button 
                label="Сохранить подзадачи" 
                size="small" 
                severity="success" 
                @click="saveSubtasks(task.id)"
              />
            </div>
          </div>

          <!-- ===== ПЕРЕНОС И ВОЗВРАТ ===== -->
          <div class="postpone-section">
            <Button 
              v-if="!task.is_overdue"
              label="Перенести на завтра" 
              icon="pi pi-calendar-plus" 
              class="p-button-outlined p-button-secondary p-button-rounded postpone-btn"
              @click="postponeTask(task.id)"
            />
            <Button 
              v-else
              label="Вернуть на исходный день" 
              icon="pi pi-undo" 
              class="p-button-outlined p-button-help p-button-rounded postpone-btn"
              @click="revertPostponeTask(task.id)"
            />
          </div>

          <!-- ===== КНОПКА УДАЛЕНИЯ ===== -->
          <div class="task-delete-action">
            <Button 
              label="Удалить задачу" 
              icon="pi pi-trash" 
              class="p-button-danger p-button-outlined p-button-rounded delete-btn"
              @click="confirmDeleteTask(task.id)"
            />
          </div>
        </template>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.calendar { display: flex; flex-direction: column; gap: 18px; }
.calendar__head { display: flex; align-items: center; gap: 10px; }
.calendar__head h1 { font-size: 26px; }
.calendar__controls { display: flex; align-items: center; gap: 12px; }
.nav { display: flex; align-items: center; gap: 6px; }
.grow { flex: 1; }

/* ===== ВЫПАДАЮЩИЙ КАЛЕНДАРЬ ===== */
.range-picker-wrapper {
  position: relative;
  display: inline-block;
}
.range-picker-trigger {
  background: #f0f4f8 !important;
  border: none !important;
  color: #2c3e50 !important;
  font-weight: 600 !important;
  padding: 0 12px !important;
  height: 36px !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
  transition: all 0.2s ease !important;
}
.range-picker-trigger:hover { background: #e2e8f0 !important; }

.range-picker-dropdown-container {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  border: 1px solid #eef2f6;
  padding: 12px 10px 10px 10px;
  min-width: 240px;
  max-width: 340px;
}

.range-picker-close-btn {
  position: absolute !important;
  top: -12px !important;
  right: -12px !important;
  z-index: 10000 !important;
  padding: 2px !important;
  width: 26px !important;
  height: 26px !important;
  border-radius: 50% !important;
  background: #ffffff !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  color: #7f8c8d !important;
}
.range-picker-close-btn:hover { background: #f8f9fa !important; }

.range-picker-actions {
  display: flex;
  justify-content: center;
  padding-top: 10px;
  margin-top: 6px;
  border-top: 1px solid #f0f4f8;
}
.range-apply-btn {
  width: 100%;
  background: #1abc9c !important;
  border: none !important;
  color: white !important;
  font-weight: 600 !important;
  padding: 8px !important;
  border-radius: 8px !important;
  font-size: 14px !important;
}
.range-apply-btn:disabled {
  opacity: 0.4 !important;
  cursor: not-allowed !important;
}

.cancel-range-btn {
  color: #e74c3c !important;
  border-color: #f8d7da !important;
}
.cancel-range-btn:hover {
  background: #f8d7da !important;
}

:deep(.p-datepicker) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  width: 100% !important;
  padding: 0 !important;
}
:deep(.p-datepicker-header) {
  background: transparent !important;
  border-bottom: none !important;
  padding: 0 0 6px 0 !important;
}
:deep(.p-datepicker-title) {
  font-weight: 700 !important;
  font-size: 13px !important;
  color: #2c3e50 !important;
}
:deep(.p-datepicker .p-datepicker-header .p-datepicker-title select) {
  font-size: 13px !important;
}
:deep(.p-datepicker-calendar th) {
  color: #7f8c8d !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  padding: 0 !important;
  height: 24px !important;
}
:deep(.p-datepicker-calendar td span) {
  width: 30px !important;
  height: 30px !important;
  border-radius: 50% !important;
  font-weight: 600 !important;
  font-size: 13px !important;
  color: #2c3e50 !important;
  transition: all 0.15s ease !important;
}
:deep(.p-datepicker-calendar td span:hover) {
  background: #f0f4f8 !important;
}
:deep(.p-datepicker-calendar td span.p-highlight) {
  background: #1abc9c !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.35) !important;
}
:deep(.p-datepicker-calendar td .p-datepicker-range) {
  background: #e8f5e9 !important;
  color: #2c3e50 !important;
  border-radius: 0 !important;
}
:deep(.p-datepicker-calendar td.p-datepicker-range-start span) {
  border-radius: 50% 0 0 50% !important;
  background: #1abc9c !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.35) !important;
}
:deep(.p-datepicker-calendar td.p-datepicker-range-end span) {
  border-radius: 0 50% 50% 0 !important;
  background: #1abc9c !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.35) !important;
}

/* ===== ДЕНЬ ===== */
.day-container {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: visible;
  padding: 20px 0 20px 0;
  display: flex;
  flex-direction: column;
}
.day-header {
  padding: 0 20px 20px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.day-header__title { font-size: 20px; font-weight: 700; color: #2c3e50; }
.day-body { display: flex; position: relative; padding: 0 20px; }
.day-body__times {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding-top: 44px;
  gap: 0;
  align-items: flex-end;
  padding-right: 12px;
}
.day-body__hour {
  font-size: 12px;
  color: #7f8c8d;
  font-weight: 500;
  height: v-bind('hourHeight + "px"');
  line-height: v-bind('hourHeight + "px"');
  transform: translateY(calc(v-bind('hourHeight / -2 + "px"')));
}
.day-body__tasks-wrapper {
  flex: 1;
  position: relative;
  min-height: calc(v-bind('hourHeight * 12 + "px"'));
  padding-top: 44px;
  padding-bottom: v-bind('hourHeight + "px"');
  overflow: visible;
}
.day-task {
  position: absolute;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #1abc9c;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
  z-index: 1;
  height: auto;
  min-height: 64px;
  overflow: visible;
  margin-top: 8px;
}
.day-task:hover {
  transform: translateX(4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
  z-index: 3;
  border-left-color: #16a085;
}
.day-task__time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 70px;
  font-size: 13px;
  font-weight: 500;
  color: #7f8c8d;
  padding-top: 2px;
}
.day-task__start { color: #2c3e50; }
.day-task__separator { display: none; }
.day-task__main { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.day-task__title-row { display: flex; align-items: center; gap: 6px; }
.day-task__icon { color: #1abc9c; font-size: 14px; }
.day-task__title { font-size: 15px; font-weight: 600; color: #2c3e50; }
.day-task__menu { color: #95a5a6; cursor: pointer; font-size: 14px; margin-left: auto; }
.day-task__badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.badge--status.badge--done { background: #d4edda; color: #155724; }
.badge--status.badge--in_progress { background: #cce5ff; color: #004085; }
.badge--status.badge--planned { background: #bbdefb; color: #0d47a1; }
.badge--priority.badge--high { background: #f8d7da; color: #721c24; }
.badge--priority.badge--medium { background: #fff3cd; color: #856404; }
.badge--priority.badge--low { background: #d1ecf1; color: #0c5460; }
.badge--overdue { background: #ffe5e5; color: #d32f2f; border: 1px solid #d32f2f; }
.day-task__previews { display: flex; gap: 6px; margin-top: 6px; }
.preview-item { width: 36px; height: 36px; border-radius: 6px; background: #eef2f6; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.preview-item img, .preview-item video { width: 100%; height: 100%; object-fit: cover; }
.preview-item i { color: #7f8c8d; font-size: 16px; }
.day-task__avatars { display: flex; gap: 4px; margin-top: 6px; }

/* ===== НЕДЕЛЯ ===== */
.week-container {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: visible;
  padding: 16px 0 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.week-header {
  display: flex;
  align-items: center;
  padding: 0 16px 16px 16px;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.week-header__time-placeholder { width: 60px; flex-shrink: 0; }
.week-header__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  border-radius: 20px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s ease;
}
.week-header__day.is-today { background: #1abc9c; border-color: #1abc9c; color: #ffffff; }
.week-header__day-name { font-size: 12px; font-weight: 600; color: inherit; }
.week-header__day-number { font-size: 14px; font-weight: 700; margin-top: 2px; }
.week-body {
  display: flex;
  position: relative;
  padding: 0 16px 16px 16px;
}
.week-body__times {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding-top: 44px;
  gap: 0;
  align-items: flex-end;
  padding-right: 8px;
}
.week-body__hour {
  font-size: 12px;
  color: #7f8c8d;
  font-weight: 500;
  height: v-bind('hourHeight + "px"');
  line-height: v-bind('hourHeight + "px"');
  transform: translateY(calc(v-bind('hourHeight / -2 + "px"')));
}
.week-body__tasks {
  flex: 1;
  position: relative;
  min-height: calc(v-bind('hourHeight * 12 + "px"'));
  padding-top: 44px;
  padding-bottom: v-bind('hourHeight + "px"');
  overflow: visible;
}

/* ===== ПРОСТАЯ ЛИНИЯ ВРЕМЕНИ ===== */
.current-time-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-top: 2px dashed #1abc9c;
  z-index: 5;
  pointer-events: none;
}

.task-card {
  position: absolute;
  background: #e0f7fa;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s ease;
  border: 1px solid rgba(26, 188, 156, 0.1);
  z-index: 1;
  height: auto;
  min-height: 70px;
  overflow: visible;
  padding-bottom: 12px;
  margin-top: 12px;
}
.task-card:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  z-index: 3;
}
.task-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.task-card__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.task-card__title-row i.pi-calendar { color: #1abc9c; font-size: 13px; }
.task-card__title {
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-card__menu { color: #95a5a6; cursor: pointer; font-size: 14px; padding-top: 2px; }
.task-card__time { font-size: 11px; color: #7f8c8d; margin-top: 2px; }
.task-card__badges { display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap; }
.task-card__previews { display: flex; gap: 6px; margin-top: 4px; overflow: hidden; }
.preview-item { width: 40px; height: 40px; border-radius: 6px; background: #eef2f6; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.preview-item img, .preview-item video { width: 100%; height: 100%; object-fit: cover; }
.preview-item i { color: #7f8c8d; font-size: 18px; }
.task-card__avatars { display: flex; gap: 4px; margin-top: 4px; }

/* ===== МЕСЯЦ ===== */
.month { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04); overflow: hidden; }
.month__head { display: grid; grid-template-columns: repeat(7, 1fr); padding: 14px 0; border-bottom: 1px solid var(--c-border); }
.month__head span { text-align: center; font-size: 12px; font-weight: 700; color: var(--c-text-muted); }
.month__grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.month__cell { min-height: 110px; border-right: 1px solid var(--c-surface-2); border-bottom: 1px solid var(--c-surface-2); padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.month__cell:nth-child(7n) { border-right: 0; }
.month__cell.is-out { background: #fbfcfd; }
.month__cell.is-out .month__num { color: var(--c-text-soft); }
.month__num { font-size: 13px; font-weight: 600; }
.month__cell.is-today .month__num { background: var(--c-primary); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; }
.month__chip { border: 0; text-align: left; background: var(--c-primary-100); color: var(--c-primary-700); border-radius: 6px; padding: 3px 6px; font-size: 11px; font-weight: 600; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.month__chip.is-high { background: var(--c-pink); color: #c0453f; }
.month__chip.is-overdue { background: #ffe5e5; color: #d32f2f; border: 1px solid #d32f2f; }
.month__more { font-size: 11px; color: var(--c-text-muted); padding: 2px 6px; cursor: pointer; background: #f0f4f8; border-radius: 4px; width: fit-content; transition: 0.2s; }
.month__more:hover { background: #e0e7ef; }

.task-detail { display: flex; flex-direction: column; gap: 12px; }
.task-detail__row { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.task-detail__row i { color: var(--c-primary); width: 18px; }
.overdue-label { color: #d32f2f; font-weight: 700; margin-left: 4px; }
.task-detail__people { display: flex; gap: 4px; margin-top: 4px; }

/* ===== СТАТУСЫ И УДАЛЕНИЕ ===== */
.task-status-selector {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef2f6;
}
.status-label {
  font-size: 13px;
  font-weight: 600;
  color: #7f8c8d;
  margin-bottom: 8px;
}
.status-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: #f8f9fa;
  border: 1px solid #eef2f6;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  color: #2c3e50;
}
.status-chip:hover {
  background: #eef2f6;
}
.status-chip--active {
  background: #e0f7fa;
  border-color: #1abc9c;
  box-shadow: 0 0 0 1px #1abc9c;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ===== ПОДЗАДАЧИ ===== */
.subtasks-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef2f6;
}
.subtask-progress-label {
  font-weight: 400;
  color: #7f8c8d;
  margin-left: 6px;
}
.subtask-progress-bar {
  width: 100%;
  height: 6px;
  background: #eef2f6;
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 12px;
}
.subtask-progress-fill {
  height: 100%;
  background: #1abc9c;
  border-radius: 99px;
  transition: width 0.3s ease;
}
.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}
.subtask-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  flex-wrap: wrap;
}
.subtask-status-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.subtask-chip {
  font-size: 11px !important;
  padding: 4px 12px !important;
}
.subtask-text {
  font-size: 14px;
  color: #2c3e50;
  flex: 1;
}
.subtask-text--done {
  text-decoration: line-through;
  color: #95a5a6;
}
.subtask-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subtask-input {
  flex: 1;
}
.subtask-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

/* ===== ПЕРЕНОС И ВОЗВРАТ ===== */
.postpone-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef2f6;
  display: flex;
  justify-content: center;
}
.postpone-btn {
  width: 100%;
  justify-content: center;
}

.task-delete-action {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef2f6;
  display: flex;
  justify-content: center;
}
.delete-btn {
  width: 100%;
  justify-content: center;
}

/* ===== КАСТОМНЫЙ ЗАГОЛОВОК ДИАЛОГА ===== */
.dialog-header-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 10px;
}
.dialog-header-title {
  font-weight: 700;
  font-size: 18px;
  color: #2c3e50;
}
.dialog-header-progress {
  display: flex;
  align-items: center;
}
.circular-progress-container {
  position: relative;
  width: 40px;
  height: 40px;
}
.circular-progress {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(#1abc9c var(--progress, 0%), #eef2f6 var(--progress, 0%));
  transition: background 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.circular-progress::before {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  background: #ffffff;
  border-radius: 50%;
}
.circular-progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: 700;
  color: #2c3e50;
  z-index: 1;
}

@media (max-width: 1100px) {
  .task-card__title { font-size: 12px; }
}
@media (max-width: 720px) {
  .week-body__times { width: 40px; }
  .week-header__time-placeholder { width: 40px; }
  .task-card__title { font-size: 10px; }
}
</style>