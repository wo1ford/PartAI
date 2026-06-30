<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router' // ДОБАВЬТЕ ЭТОТ ИМПОРТ, если у вас есть Vue Router
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import FileUpload from 'primevue/fileupload'
import { useToast } from 'primevue/usetoast'
import type { Granularity, StatsSummary, Task } from '@/shared/types'
import { StatsApi } from '@/services/stats.api'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'
import { firstName, greeting, hhmm } from '@/shared/lib/format'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.vue'
import { DepartmentApi } from '@/services/departments.api'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import { TaskApi } from '@/services/tasks.api' // Добавили для получения задач
import StatusTag from '@/shared/ui/StatusTag.vue'
import TaskFormDialog from '@/features/task/TaskFormDialog.vue' // Импортируем форму редактирования

// ===== НОВЫЙ ИМПОРТ КОМПОНЕНТА ЗАГРУЗКИ =====
import FileImportModal from '@/shared/ui/FileImportModal.vue'

const auth = useAuthStore()
const office = useOfficeStore()
const toast = useToast()
const router = useRouter() // Добавьте это для перехода к календарю

const granularity = ref<Granularity>('day')
const summary = ref<StatsSummary | null>(null)
const loading = ref(false)

const tabs: { label: string; value: Granularity }[] = [
  { label: 'День', value: 'day' },
  { label: 'Месяц', value: 'month' },
  { label: 'Год', value: 'year' },
]

// ===== ДАННЫЕ ДЛЯ ГРАФИКОВ =====
const departmentStats = ref<{ name: string; tasks: number }[]>([])

// ===== ВЫЧИСЛЕНИЕ ДАННЫХ В ЗАВИСИМОСТИ ОТ ФИЛЬТРА =====
const filteredStats = computed(() => {
  if (!summary.value) return null
  
  let multiplier = 1
  if (granularity.value === 'day') multiplier = 0.1
  else if (granularity.value === 'month') multiplier = 0.5
  else if (granularity.value === 'year') multiplier = 1.2

  const total = Math.round(summary.value.tasks_open * multiplier)
  
  return {
    total: total,
    inProgress: Math.round(total * 0.3),
    done: Math.round(total * 0.4),
    overdue: Math.round(total * 0.2),
    members: summary.value.members_total
  }
})

// ===== НАСТРОЙКИ ВИДЖЕТОВ =====
const settingsOpen = ref(false)
const visibleWidgets = ref({
  stats: true,
  chart: true,
  departments: true,
  tasks: true,
  files: false,
  customChart: false, // Добавлен новый виджет для графика
})

// ===== ДИНАМИКА ЗАДАЧ (Не зависит от верхних фильтров!) =====
const chartView = ref<'week' | 'month'>('month')

// Данные для месяца (12 месяцев, начиная с текущего)
const monthLabels = ['Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек', 'Янв', 'Фев', 'Мар', 'Апр', 'Май']

// Данные для недели (7 дней, начиная с понедельника)
const weekLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// РЕАЛЬНЫЕ ДАННЫЕ ДЛЯ НЕДЕЛИ (эмуляция)
const weekData = [8, 9, 12, 7, 6, 0, 0]
const maxWeekValue = Math.max(...weekData)

// Данные для месяца (только первый месяц имеет значение, остальные пустые)
const monthData = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

// ===== ЭКСПОРТ ИЗОБРАЖЕНИЯ =====
const exportDialogOpen = ref(false)
const exportWidgetTitle = ref('')
const exportFileName = ref('dashboard')
const exportFormat = ref('png')

function openExport(title: string) {
  exportWidgetTitle.value = title
  exportFileName.value = title.toLowerCase().replace(/\s/g, '-')
  exportFormat.value = 'png'
  exportDialogOpen.value = true
}

function downloadWidget() {
  const blob = new Blob([`Экспорт виджета: ${exportWidgetTitle.value}`], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${exportFileName.value}.${exportFormat.value}`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ severity: 'success', summary: 'Скачивание начато', detail: `${exportFileName.value}.${exportFormat.value}`, life: 2000 })
  exportDialogOpen.value = false
}

// ===== НОВАЯ ЛОГИКА ИМПОРТА ГРАФИКА =====
const importModalVisible = ref(false)
const customChartData = ref<{
  title: string;
  type: string;
  labels: string[];
  values: number[];
  xLabel: string;
  yLabel: string;
} | null>(null)

// Функция, которая вызывается, когда пользователь нажал "Построить график" в модалке
const handleGraphBuilt = (data: any) => {
  customChartData.value = data
  // Автоматически включаем виджет графика в настройках
  visibleWidgets.value.customChart = true
  toast.add({ severity: 'success', summary: 'График построен', detail: `Тип: ${data.type}`, life: 3000 })
}

// ===== ЛОГИКА КОНТЕКСТНЫХ МЕНЮ (Задачи) =====
const taskList = ref<Task[]>([]) // Список всех задач для модального окна

// 1. Меню виджета (в шапке)
const widgetMenuVisible = ref(false)
const widgetMenuRef = ref<HTMLElement>()
const widgetMenuPosition = ref({ x: 0, y: 0 })

const openWidgetMenu = (event: Event) => {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  widgetMenuPosition.value = {
    x: rect.left - 150,
    y: rect.bottom + 8
  }
  widgetMenuVisible.value = true
}

const closeWidgetMenu = () => {
  widgetMenuVisible.value = false
}

// Действия из меню виджета
const goToCalendar = () => {
  closeWidgetMenu()
  router.push('/calendar')
}

const openAllTasksDialog = async () => {
  closeWidgetMenu()
  // Загружаем все задачи офиса
  if (!office.activeOfficeId) return
  taskList.value = await TaskApi.list({ 
    officeId: office.activeOfficeId, 
    limit: 50 // Берем последние 50
  })
  allTasksDialogVisible.value = true
}

// 2. Меню отдельной задачи (в строке)
const taskMenuVisible = ref(false)
const selectedTaskForMenu = ref<Task | null>(null)
const taskMenuPosition = ref({ x: 0, y: 0 })

const openTaskMenu = (event: Event, task: Task) => {
  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()
  taskMenuPosition.value = {
    x: rect.left - 150,
    y: rect.bottom + 8
  }
  selectedTaskForMenu.value = task
  taskMenuVisible.value = true
}

const closeTaskMenu = () => {
  taskMenuVisible.value = false
}

// Действия из меню задачи
const goToCalendarWithTask = (taskId: string) => {
  closeTaskMenu()
  router.push(`/calendar?taskId=${taskId}`)
}

const openTaskInfo = (task: Task) => {
  closeTaskMenu()
  selectedTaskId.value = task.id
  taskInfoDialogVisible.value = true
}

const openTaskEdit = (task: Task) => {
  closeTaskMenu()
  editingTask.value = task
  editOpen.value = true
}

// ===== ДИАЛОГИ ДЛЯ ЗАДАЧ (Аналоги CalendarPage) =====
const allTasksDialogVisible = ref(false)
const taskInfoDialogVisible = ref(false)
const selectedTaskId = ref<string | null>(null)

// Форма редактирования
const editOpen = ref(false)
const editingTask = ref<Task | null>(null)

// ===== CLICK OUTSIDE LOGIC (чтобы меню закрывалось при клике вне его) =====
const handleGlobalClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // Проверяем меню виджета
  if (widgetMenuVisible.value) {
    const widgetMenuElement = document.querySelector('.context-menu.widget-menu')
    const widgetBtnElement = document.querySelector('.menu-btn')
    
    // Если клик был НЕ по меню и НЕ по кнопке открытия
    if (widgetMenuElement && !widgetMenuElement.contains(target) && widgetBtnElement && !widgetBtnElement.contains(target)) {
      closeWidgetMenu()
    }
  }

  // Проверяем меню задачи
  if (taskMenuVisible.value) {
    const taskMenuElement = document.querySelector('.context-menu.task-menu')
    const taskBtnElements = document.querySelectorAll('.task-action-menu-btn')
    
    let clickedOnTaskBtn = false
    taskBtnElements.forEach(btn => {
      if (btn.contains(target)) clickedOnTaskBtn = true
    })

    if (taskMenuElement && !taskMenuElement.contains(target) && !clickedOnTaskBtn) {
      closeTaskMenu()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})

// ===== ЗАГРУЗКА ДАННЫХ =====
async function load(): Promise<void> {
  loading.value = true
  try {
    const query = { 
      officeId: office.activeOfficeId, 
      granularity: granularity.value
    }
    
    const [sum, deps] = await Promise.all([
      StatsApi.summary(query),
      DepartmentApi.list(office.activeOfficeId!)
    ])
    summary.value = sum
    
    departmentStats.value = deps.map(d => ({
      name: d.name,
      tasks: d.stats?.tasks_total || 0
    })).sort((a, b) => b.tasks - a.tasks)
  } finally {
    loading.value = false
  }
}

async function downloadCsv(): Promise<void> {
  const blob = await StatsApi.exportCsv({ officeId: office.activeOfficeId, granularity: granularity.value })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stats-${granularity.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Следим за изменением фильтров и перезагружаем данные
watch([granularity, () => office.activeOfficeId], load)
onMounted(load)
</script>

<template>
  <div class="dashboard">
    <!-- Хедер -->
    <div class="dashboard-header">
      <div class="header-greeting">
        <p class="muted-text">Ваша аналитика</p>
        <h1>{{ greeting() }}, {{ auth.user ? firstName(auth.user.full_name) : '' }}</h1>
      </div>
      
      <div class="header-actions">
        <SegmentedTabs v-model="granularity" :options="tabs" />
        
        <!-- ОБНОВЛЕННАЯ КНОПКА ИМПОРТА ДЛЯ XLSX -->
        <Button label="Импорт XLSX" icon="pi pi-file-excel" class="action-btn" @click="importModalVisible = true" />
        
        <Button label="Экспорт" icon="pi pi-download" class="action-btn" @click="downloadCsv" />
        <Button icon="pi pi-sliders-h" class="action-btn square-btn" @click="settingsOpen = true" />
      </div>
    </div>

    <!-- ===== БЛОК БЫСТРОЙ СТАТИСТИКИ (Quick Stats) ===== -->
    <div v-if="visibleWidgets.stats && filteredStats" class="stats-ribbon">
      <div class="stat-card">
        <div class="stat-icon"><i class="pi pi-list"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ filteredStats.total }}</span>
          <span class="stat-label">Всего задач</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="pi pi-clock"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ filteredStats.inProgress }}</span>
          <span class="stat-label">В процессе</span>
        </div>
      </div>
      <div class="stat-card active-turquoise">
        <div class="stat-icon"><i class="pi pi-check-circle"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ filteredStats.done }}</span>
          <span class="stat-label">Выполнено</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="pi pi-exclamation-triangle"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ filteredStats.overdue }}</span>
          <span class="stat-label">Просрочено</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="pi pi-building"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ departmentStats?.length || 0 }}</span>
          <span class="stat-label">Отделов</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="pi pi-users"></i></div>
        <div class="stat-content">
          <span class="stat-value">{{ filteredStats.members || 0 }}</span>
          <span class="stat-label">Членов партии</span>
        </div>
      </div>
    </div>

    <!-- ===== ОСНОВНАЯ СЕТКА ===== -->
    <div class="main-grid">
      
      <!-- ЛЕВАЯ КОЛОНКА -->
      <div class="col-left">
        
        <!-- Динамика задач (Неделя / Месяц) -->
        <div v-if="visibleWidgets.chart" class="surface-card chart-card">
          <div class="card-header">
            <h3>Динамика задач</h3>
            <div class="filter-chips">
              <button 
                class="filter-chip" 
                :class="{ active: chartView === 'week' }"
                @click="chartView = 'week'"
              >Неделя</button>
              <button 
                class="filter-chip" 
                :class="{ active: chartView === 'month' }"
                @click="chartView = 'month'"
              >Месяц</button>
            </div>
          </div>
          
          <div class="chart-container">
            <div class="chart-bars">
              
              <!-- Отрисовка для Месяца -->
              <template v-if="chartView === 'month'">
                <div v-for="(label, index) in monthLabels" :key="index" class="bar-group">
                  <template v-if="monthData[index] > 0">
                    <div class="bar-tooltip">{{ monthData[index] }}</div>
                    <div class="bar bar-filled-month"></div>
                  </template>
                  <template v-else>
                    <div class="empty-space"></div>
                  </template>
                  <span class="bar-label">{{ label }}</span>
                </div>
              </template>

              <!-- Отрисовка для Недели -->
              <template v-else>
                <div v-for="(label, index) in weekLabels" :key="index" class="bar-group">
                  <template v-if="weekData[index] > 0">
                    <div class="bar-tooltip">{{ weekData[index] }}</div>
                    <div 
                      class="bar bar-filled-week"
                      :style="{ height: (weekData[index] / maxWeekValue) * 70 + 10 + '%' }"
                    ></div>
                  </template>
                  <template v-else>
                    <div class="empty-space"></div>
                  </template>
                  <span class="bar-label">{{ label }}</span>
                </div>
              </template>

            </div>
          </div>
        </div>

        <!-- Последние задачи (ОБНОВЛЕННЫЙ БЛОК) -->
        <div v-if="visibleWidgets.tasks" class="surface-card manage-card">
          <div class="card-header">
            <div>
              <h3>Последние задачи</h3>
              <span class="muted-text">Активность команды</span>
            </div>
            <!-- Кнопка с троеточием для виджета -->
            <div class="menu-wrapper" ref="widgetMenuRef">
              <Button icon="pi pi-ellipsis-v" text rounded class="menu-btn" @click="openWidgetMenu" />
            </div>
          </div>
          
          <div class="job-table">
            <div class="job-row header-row">
              <span class="col-title">Задача</span>
              <span class="col-company">Отдел</span>
              <span class="col-status">Статус</span>
              <span class="col-date">Создана</span>
              <span class="col-actions"></span>
            </div>
            <div v-for="i in 4" :key="i" class="job-row">
              <div class="col-title">
                <div class="job-name">
                  <HexAvatar :name="'Сотрудник ' + i" :color="i % 2 === 0 ? '#1abc9c' : '#f39c12'" :size="28" />
                  Задача №{{ 100 + i }}
                </div>
              </div>
              <div class="col-company">{{ departmentStats[i % (departmentStats.length || 1)]?.name || 'Общий' }}</div>
              <div class="col-status">
                <span class="status-badge" :class="{ 'pending': i === 1, 'active': i === 2, 'expired': i === 3, 'done': i === 4 }">
                  {{ i === 1 ? 'Ожидает' : i === 2 ? 'В процессе' : i === 3 ? 'Просрочена' : 'Сделано' }}
                </span>
              </div>
              <div class="col-date">{{ ['10 июн', '08 июн', '02 фев', '05 мар'][i-1] }}</div>
              <div class="col-actions">
                <Button icon="pi pi-ellipsis-h" text class="task-action-menu-btn" @click="openTaskMenu($event, { id: 'task-' + i, title: 'Задача №' + (100 + i) } as any)" />
              </div>
            </div>
          </div>
        </div>

        <!-- ===== НОВЫЙ ВИДЖЕТ: ПОСТРОЕННЫЙ ГРАФИК ИЗ XLSX ===== -->
        <div v-if="visibleWidgets.customChart && customChartData" class="surface-card chart-card">
          <div class="card-header">
            <h3>{{ customChartData.title || 'Построенный график' }}</h3>
            <Button icon="pi pi-trash" text severity="danger" @click="customChartData = null; visibleWidgets.customChart = false" />
          </div>
          
          <div class="chart-container-custom">
            <div class="graph-visual-placeholder">
              <p style="margin-bottom: 8px;">Тип диаграммы: <strong>{{ customChartData.type === 'bar' ? 'Столбчатая' : customChartData.type === 'line' ? 'Линейная' : 'Круговая' }}</strong></p>
              <div class="mock-graph">
                <div class="mock-bars">
                  <div v-for="(val, idx) in customChartData.values.slice(0, 10)" :key="idx" 
                       class="mock-bar" 
                       :style="{ height: (val / Math.max(...customChartData.values) * 100) + '%', background: '#1abc9c' }">
                  </div>
                </div>
                <div class="mock-axis-x">{{ customChartData.xLabel }}</div>
              </div>
              <p class="muted-text" style="text-align: center; margin-top: 12px; font-size: 13px;">
                Данные загружены из XLSX ({{ customChartData.labels.length }} записей)
              </p>
            </div>
          </div>
        </div>

      </div>

      <!-- ПРАВАЯ КОЛОНКА -->
      <div class="col-right">
        
        <!-- Загрузка отделов -->
        <div v-if="visibleWidgets.departments && departmentStats.length" class="surface-card pending-card">
          <div class="card-header">
            <h3>Загрузка отделов</h3>
            <i class="pi pi-chart-bar refresh-icon"></i>
          </div>
          <div class="pending-list">
            <div v-for="dept in departmentStats.slice(0, 4)" :key="dept.name" class="pending-item">
              <div class="pending-logo" style="background: #1abc9c;">
                {{ dept.name.charAt(0) }}
              </div>
              <div class="pending-info">
                <span class="pending-title">{{ dept.name }}</span>
                <span class="pending-meta">
                  <div class="dept-track">
                    <div 
                      class="dept-track-fill"
                      :style="{ width: (dept.tasks / Math.max(...departmentStats.map(d => d.tasks)) * 100) + '%' }"
                    />
                  </div>
                </span>
              </div>
              <span class="status-badge active">{{ dept.tasks }} задач</span>
            </div>
          </div>
        </div>

        <!-- KPI -->
        <div class="surface-card quick-metrics-card">
          <div class="card-header">
            <h3>KPI</h3>
          </div>
          <div class="metrics-grid" v-if="filteredStats">
            <div class="metric-item">
              <span class="metric-label">Выполнено</span>
              <span class="metric-value">{{ filteredStats.done }}</span>
              <span class="metric-trend up">↑ 12%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Просрочено</span>
              <span class="metric-value">{{ filteredStats.overdue }}</span>
              <span class="metric-trend down">↑ 5%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Членов партии</span>
              <span class="metric-value">{{ filteredStats.members || 0 }}</span>
              <span class="metric-trend up">Онлайн</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ===== ДИАЛОГИ ===== -->
    <Dialog v-model:visible="settingsOpen" modal header="Настройка виджетов" :style="{ width: '380px' }">
      <div class="settings-list">
        <div class="settings-item"><Checkbox v-model="visibleWidgets.stats" :binary="true" /> <label>Быстрая статистика</label></div>
        <div class="settings-item"><Checkbox v-model="visibleWidgets.chart" :binary="true" /> <label>Динамика задач</label></div>
        <div class="settings-item"><Checkbox v-model="visibleWidgets.departments" :binary="true" /> <label>Загрузка отделов</label></div>
        <div class="settings-item"><Checkbox v-model="visibleWidgets.tasks" :binary="true" /> <label>Последние задачи</label></div>
        <div class="settings-item" v-if="customChartData"><Checkbox v-model="visibleWidgets.customChart" :binary="true" /> <label>График из XLSX</label></div>
        <div v-else class="settings-item muted">Загрузите XLSX через "Импорт XLSX"</div>
      </div>
      <template #footer><Button label="Готово" icon="pi pi-check" @click="settingsOpen = false" /></template>
    </Dialog>

    <Dialog v-model:visible="exportDialogOpen" modal header="Экспорт виджета" :style="{ width: '420px' }">
      <div class="export-form">
        <div class="field"><label>Название</label><InputText v-model="exportFileName" fluid /></div>
        <div class="field"><label>Формат</label><Select v-model="exportFormat" :options="['png', 'jpg', 'pdf']" fluid /></div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="exportDialogOpen = false" />
        <Button label="Скачать" icon="pi pi-download" severity="success" @click="downloadWidget" />
      </template>
    </Dialog>

    <!-- ===== НОВЫЕ ДИАЛОГИ ДЛЯ ЗАДАЧ (аналоги CalendarPage) ===== -->
    
    <!-- Диалог: Все задачи -->
    <Dialog 
      v-model:visible="allTasksDialogVisible" 
      modal 
      header="Все задачи" 
      :style="{ width: '600px' }"
    >
      <div class="all-tasks-list">
        <div v-for="task in taskList" :key="task.id" class="task-mini-row">
          <div class="task-mini-title">{{ task.title }}</div>
          <div class="task-mini-meta">
            <StatusTag :status="task.status" />
            <span class="task-mini-date">{{ hhmm(new Date(task.starts_at)) }}</span>
          </div>
          <div class="task-mini-actions">
            <Button icon="pi pi-info-circle" text rounded size="small" @click="selectedTaskId = task.id; allTasksDialogVisible = false; taskInfoDialogVisible = true" />
          </div>
        </div>
        <div v-if="taskList.length === 0" class="empty-state">Задачи не найдены</div>
      </div>
    </Dialog>

    <!-- Диалог: Инфо о задаче (полностью из CalendarPage) -->
    <Dialog
      :visible="taskInfoDialogVisible"
      modal
      :style="{ width: '520px' }"
      @update:visible="(val) => { if (!val) taskInfoDialogVisible = false }"
    >
      <template #header>
        <div class="dialog-header-custom">
          <div class="dialog-header-title">
            {{ taskList.find(t => t.id === selectedTaskId)?.title || 'Задача' }}
          </div>
        </div>
      </template>

      <div v-if="selectedTaskId" class="task-detail">
        <template v-for="task in taskList.filter(t => t.id === selectedTaskId)" :key="task.id">
          <div class="task-detail__row"><i class="pi pi-clock" /><span>{{ hhmm(new Date(task.starts_at)) }}{{ task.ends_at ? ' – ' + hhmm(new Date(task.ends_at)) : '' }}</span></div>
          <div v-if="task.department" class="task-detail__row"><i class="pi pi-th-large" /><span>{{ task.department.name }}</span></div>
          <div v-if="task.project" class="task-detail__row"><i class="pi pi-briefcase" /><span>{{ task.project.name }}</span></div>
          <div class="task-detail__row"><i class="pi pi-flag" /><StatusTag :status="task.status" /><StatusTag :priority="task.priority" /></div>
        </template>
      </div>
    </Dialog>

    <!-- Форма редактирования задачи (из features/task) -->
    <TaskFormDialog
      v-if="office.activeOfficeId && editingTask"
      v-model:visible="editOpen"
      :office-id="office.activeOfficeId"
      :task="editingTask"
      @updated="load"
      @created="load"
    />

    <!-- ===== КОНТЕКСТНОЕ МЕНЮ ВИДЖЕТА ===== -->
    <Teleport to="body">
      <div 
        v-show="widgetMenuVisible" 
        class="context-menu widget-menu"
        :style="{ left: widgetMenuPosition.x + 'px', top: widgetMenuPosition.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="openAllTasksDialog">
          <i class="pi pi-list"></i> Открыть (все задачи)
        </div>
        <div class="context-menu-item" @click="goToCalendar">
          <i class="pi pi-calendar"></i> Перейти к календарю
        </div>
      </div>
    </Teleport>

    <!-- ===== КОНТЕКСТНОЕ МЕНЮ ЗАДАЧИ ===== -->
    <Teleport to="body">
      <div 
        v-show="taskMenuVisible" 
        class="context-menu task-menu"
        :style="{ left: taskMenuPosition.x + 'px', top: taskMenuPosition.y + 'px' }"
        @click.stop
      >
        <div 
          v-if="selectedTaskForMenu" 
          class="context-menu-item" 
          @click="goToCalendarWithTask(selectedTaskForMenu.id)"
        >
          <i class="pi pi-calendar"></i> Перейти к календарю
        </div>
        <div 
          v-if="selectedTaskForMenu" 
          class="context-menu-item" 
          @click="openTaskInfo(selectedTaskForMenu)"
        >
          <i class="pi pi-info-circle"></i> Инфо
        </div>
        <div 
          v-if="selectedTaskForMenu" 
          class="context-menu-item" 
          @click="openTaskEdit(selectedTaskForMenu)"
        >
          <i class="pi pi-pencil"></i> Редактировать задачу
        </div>
      </div>
    </Teleport>

    <!-- ===== КОМПОНЕНТ ИМПОРТА ===== -->
    <FileImportModal v-model:visible="importModalVisible" @graph-built="handleGraphBuilt" />
  </div>
</template>

<style scoped>
/* ===== ОБЩАЯ СТРУКТУРА ===== */
.dashboard { display: flex; flex-direction: column; gap: 20px; max-width: 1400px; margin: 0 auto; padding: 0 12px; }

/* ===== ХЕДЕР ===== */
.dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
.header-greeting .muted-text { font-size: 13px; color: #95a5a6; margin: 0; }
.header-greeting h1 { font-size: 28px; font-weight: 700; margin: 0; color: #2c3e50; }

.header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.action-btn { background: #1abc9c !important; border: none !important; color: white !important; padding: 8px 16px !important; border-radius: 8px !important; font-size: 14px !important; }
.action-btn:hover { background: #16a085 !important; }
.square-btn { padding: 8px 12px !important; }

/* ===== QUICK STATS (6 Карточек) ===== */
.stats-ribbon {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
.stat-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  border: 1px solid #f0f4f8;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06); }

.stat-card.active-turquoise {
  background: #1abc9c;
  border-color: #1abc9c;
  color: #ffffff;
}
.stat-card.active-turquoise .stat-value { color: #ffffff; }
.stat-card.active-turquoise .stat-label { color: rgba(255,255,255,0.7); }
.stat-card.active-turquoise .stat-icon { background: rgba(255,255,255,0.15); color: #ffffff; }

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #f0f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1abc9c;
  font-size: 18px;
}
.stat-content { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat-value { font-size: 22px; font-weight: 700; color: #2c3e50; }
.stat-label { font-size: 12px; color: #95a5a6; }

/* ===== ОСНОВНАЯ СЕТКА ===== */
.main-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}
.col-left { display: flex; flex-direction: column; gap: 20px; }
.col-right { display: flex; flex-direction: column; gap: 20px; }

/* ===== КАРТОЧКИ (Surface Cards) ===== */
.surface-card {
  background: #ffffff;
  border: 1px solid #f0f4f8;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.card-header h3 { font-size: 16px; font-weight: 600; margin: 0; color: #2c3e50; }
.muted-text { font-size: 13px; color: #95a5a6; }
.menu-wrapper { position: relative; }

/* ===== ФИЛЬТРЫ (Неделя / Месяц) ===== */
.filter-chips {
  display: flex;
  background: #f0f4f8;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.filter-chip {
  border: none;
  background: transparent;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #7f8c8d;
  cursor: pointer;
  transition: all 0.2s ease;
}
.filter-chip:hover { color: #2c3e50; }
.filter-chip.active {
  background: #1abc9c;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(26, 188, 156, 0.25);
}

/* ===== ДИНАМИКА ЗАДАЧ ===== */
.chart-container { padding: 8px 0; }
.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 140px;
  gap: 10px;
}
.bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
  gap: 0;
}

.bar-tooltip {
  background: #1abc9c;
  color: #ffffff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.3);
}

.bar-filled-month {
  width: 80%;
  height: 60%;
  background: #1abc9c;
  border-radius: 6px 6px 0 0;
  transition: height 0.4s ease;
}

.bar-filled-week {
  width: 80%;
  background: #1abc9c;
  border-radius: 6px 6px 0 0;
  transition: height 0.4s ease;
}

.empty-space { height: 4px; opacity: 0; }
.bar-label { font-size: 11px; color: #95a5a6; font-weight: 500; padding-top: 8px; }

/* ===== ПОСЛЕДНИЕ ЗАДАЧИ (Таблица) ===== */
.job-table { display: flex; flex-direction: column; gap: 6px; }
.job-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1.5fr 0.5fr;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f4f8;
  font-size: 14px;
  color: #2c3e50;
}
.job-row.header-row {
  border-bottom: 2px solid #f0f4f8;
  color: #95a5a6;
  font-size: 12px;
  font-weight: 600;
}
.job-row:last-child { border-bottom: none; }

.col-title .job-name { display: flex; align-items: center; gap: 10px; font-weight: 500; }
.col-company, .col-date { color: #7f8c8d; }
.col-actions { text-align: right; color: #95a5a6; cursor: pointer; }
.task-action-menu-btn { color: #95a5a6 !important; padding: 0 6px !important; }
.task-action-menu-btn:hover { color: #1abc9c !important; background: #e6f7f0 !important; }

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #f0f4f8;
  color: #2c3e50;
}
.status-badge.pending { background: #fef0e6; color: #e67e22; }
.status-badge.active { background: #e6f7f0; color: #1abc9c; }
.status-badge.expired { background: #fde8e8; color: #e74c3c; }
.status-badge.done { background: #e6f7f0; color: #1abc9c; }

/* ===== ВИДЖЕТ ГРАФИКА ИЗ XLSX ===== */
.chart-container-custom { min-height: 200px; display: flex; align-items: center; justify-content: center; padding: 12px 0; }
.graph-visual-placeholder { display: flex; flex-direction: column; align-items: center; width: 90%; max-width: 600px; }
.mock-graph { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 8px; }
.mock-bars { display: flex; align-items: flex-end; gap: 6px; height: 140px; width: 100%; border-bottom: 2px solid #e2e8f0; padding-bottom: 0; justify-content: center; }
.mock-bar { flex: 1; max-width: 40px; min-width: 10px; border-radius: 4px 4px 0 0; transition: height 0.5s; }
.mock-axis-x { font-size: 12px; color: #94a3b8; margin-top: 4px; }

/* ===== ЗАГРУЗКА ОТДЕЛОВ ===== */
.pending-card .refresh-icon { color: #95a5a6; cursor: pointer; font-size: 18px; }
.pending-list { display: flex; flex-direction: column; gap: 16px; }
.pending-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f4f8;
}
.pending-item:last-child { border-bottom: none; }

.pending-logo {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #ffffff;
}

.pending-info { display: flex; flex-direction: column; flex: 1; gap: 2px; }
.pending-title { font-size: 15px; font-weight: 600; color: #2c3e50; }
.pending-meta { font-size: 12px; color: #95a5a6; width: 100%; }

.dept-track {
  width: 100%;
  height: 6px;
  background: #f0f4f8;
  border-radius: 99px;
  overflow: hidden;
  margin-top: 4px;
}
.dept-track-fill {
  height: 100%;
  background: #1abc9c;
  border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ===== KPI ===== */
.metrics-grid { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
.metric-item { display: flex; align-items: center; justify-content: space-between; }
.metric-label { font-size: 14px; color: #7f8c8d; }
.metric-value { font-size: 18px; font-weight: 600; color: #2c3e50; }
.metric-trend { font-size: 12px; font-weight: 500; }
.metric-trend.up { color: #1abc9c; }
.metric-trend.down { color: #e74c3c; }

/* ===== ДИАЛОГИ ===== */
.settings-list { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.settings-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #2c3e50; }
.settings-item.muted { color: #7f8c8d; padding-left: 32px; font-size: 13px; }
.export-form { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 12px; font-weight: 600; color: #7f8c8d; }

/* ===== КОНТЕКСТНОЕ МЕНЮ ===== */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  min-width: 200px;
  max-width: 260px;
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
  cursor: pointer;
  transition: background 0.15s ease;
}
.context-menu-item:hover {
  background: #f0f4f8;
}
.context-menu-item i {
  color: #7f8c8d;
  font-size: 16px;
  width: 20px;
  text-align: center;
}
.context-menu-item:hover i {
  color: #2c3e50;
}

/* ===== ДИАЛОГ ЗАДАЧ (из CalendarPage) ===== */
.all-tasks-list { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; }
.task-mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #f0f4f8;
  border-radius: 8px;
  background: #fafbfc;
}
.task-mini-title { font-size: 14px; font-weight: 600; flex: 1; }
.task-mini-meta { display: flex; gap: 10px; align-items: center; }
.task-mini-date { font-size: 12px; color: #7f8c8d; }
.task-mini-actions { display: flex; gap: 4px; }
.empty-state { text-align: center; color: #95a5a6; padding: 20px 0; }

.task-detail { display: flex; flex-direction: column; gap: 12px; }
.task-detail__row { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.task-detail__row i { color: #1abc9c; width: 18px; }

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

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 1100px) { 
  .main-grid { grid-template-columns: 1fr; }
  .stats-ribbon { grid-template-columns: repeat(3, 1fr); }
  .col-right { display: grid; grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .stats-ribbon { grid-template-columns: repeat(2, 1fr); }
  .col-right { grid-template-columns: 1fr; }
  .header-actions { width: 100%; justify-content: flex-start; flex-wrap: wrap; gap: 8px; }
  .dashboard-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .job-row { grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .job-row.header-row { display: none; }
  .col-company, .col-location, .col-date { color: #7f8c8d; }
  .context-menu { min-width: 160px; }
}
</style>