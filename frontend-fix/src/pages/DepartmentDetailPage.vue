<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import type { Department, DepartmentSummary, Employee, Project, Task } from '@/shared/types'
import { DepartmentApi } from '@/services/departments.api'
import { EmployeeApi } from '@/services/employees.api'
import { ProjectApi } from '@/services/projects.api'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import TaskFormDialog from '@/features/task/TaskFormDialog.vue'
import { addDays, isSameDay, startOfWeek } from '@/shared/lib/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const office = useOfficeStore()

const summary = ref<DepartmentSummary | null>(null)
const departments = ref<Department[]>([])
const projects = ref<Project[]>([])
const employees = ref<Employee[]>([])
const taskOpen = ref(false)

const departmentId = computed(() => String(route.params.id))
const canCreate = computed(() => auth.can('task:write') || auth.can('task:create:own'))

// ===== РАСЧЕТ СТАТИСТИКИ И ГРАФИКОВ =====
const statusStats = computed(() => {
  if (!summary.value) return { planned: 0, inProgress: 0, done: 0 }
  const tasks = summary.value.tasks
  return {
    planned: tasks.filter(t => t.status === 'planned').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }
})

const overdueCount = computed(() => {
  if (!summary.value) return 0
  const now = new Date()
  return summary.value.tasks.filter(t => 
    t.status !== 'done' && t.ends_at && new Date(t.ends_at) < now
  ).length
})

const todayTasks = computed(() => {
  if (!summary.value) return 0
  const today = new Date()
  return summary.value.tasks.filter(t => isSameDay(new Date(t.starts_at), today)).length
})

// Данные для круговой диаграммы
const donutData = computed(() => {
  const { planned, inProgress, done } = statusStats.value
  const total = planned + inProgress + done
  if (total === 0) return { segments: [], total: 0 }
  
  const donePercent = (done / total) * 100
  const inProgressPercent = (inProgress / total) * 100
  const plannedPercent = (planned / total) * 100
  
  return {
    total,
    segments: [
      { label: 'Сделано', value: done, color: '#81c784', percent: donePercent },
      { label: 'В процессе', value: inProgress, color: '#ffb74d', percent: inProgressPercent },
      { label: 'Запланировано', value: planned, color: '#90caf9', percent: plannedPercent },
    ]
  }
})

// Данные для столбчатой диаграммы (по дням недели)
const barData = computed(() => {
  if (!summary.value) return []
  const start = startOfWeek(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  
  return days.map(day => {
    const count = summary.value!.tasks.filter(t => isSameDay(new Date(t.starts_at), day)).length
    return {
      day,
      label: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][day.getDay()],
      count,
      isToday: isSameDay(day, new Date())
    }
  })
})

const maxBarCount = computed(() => {
  if (barData.value.length === 0) return 1
  return Math.max(...barData.value.map(b => b.count), 1)
})

async function load(): Promise<void> {
  summary.value = await DepartmentApi.summary(departmentId.value)
  if (office.activeOfficeId) {
    const [deps, prjs, emps] = await Promise.all([
      DepartmentApi.list(office.activeOfficeId),
      ProjectApi.list(),
      EmployeeApi.list({ officeId: office.activeOfficeId }),
    ])
    departments.value = deps
    projects.value = prjs
    employees.value = emps
  }
}

watch(departmentId, load)
onMounted(load)
</script>

<template>
  <div v-if="summary">
    <div class="detail-head">
      <Button icon="pi pi-arrow-left" rounded text aria-label="Назад" @click="router.push('/departments')" />
      <span class="detail-head__badge" :style="{ background: summary.department.color }" />
      <h1>{{ summary.department.name }}</h1>
      <div class="grow" />
      <Button v-if="canCreate" label="Создать задачу" icon="pi pi-plus" @click="taskOpen = true" />
    </div>

    <!-- ===== KPI ПАНЕЛЬ ===== -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon"><i class="pi pi-list" /></div>
        <div class="kpi-content">
          <span class="kpi-value">{{ summary.department.stats.tasks_total }}</span>
          <span class="kpi-label">Всего задач</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon success"><i class="pi pi-check-circle" /></div>
        <div class="kpi-content">
          <span class="kpi-value">{{ statusStats.done }}</span>
          <span class="kpi-label">Выполнено</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon warning"><i class="pi pi-clock" /></div>
        <div class="kpi-content">
          <span class="kpi-value">{{ statusStats.inProgress }}</span>
          <span class="kpi-label">В процессе</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon danger"><i class="pi pi-exclamation-triangle" /></div>
        <div class="kpi-content">
          <span class="kpi-value">{{ overdueCount }}</span>
          <span class="kpi-label">Просрочено</span>
        </div>
      </div>
      <div class="kpi-card full-width">
        <div class="kpi-icon info"><i class="pi pi-calendar-today" /></div>
        <div class="kpi-content">
          <span class="kpi-value">{{ todayTasks }}</span>
          <span class="kpi-label">Задач на сегодня</span>
        </div>
      </div>
    </div>

    <!-- ===== ГРАФИКИ ===== -->
    <div class="charts-grid">
      <!-- Круговая диаграмма -->
      <div class="chart-card surface-card">
        <h3 class="chart-title">Статусы задач</h3>
        <div class="donut-wrapper">
          <div class="donut-chart">
            <div 
              v-for="(seg, index) in donutData.segments" 
              :key="seg.label"
              class="donut-segment"
              :style="{
                '--color': seg.color,
                '--percent': seg.percent + '%',
                '--rotation': index === 0 ? '0deg' : (donutData.segments.slice(0, index).reduce((acc, s) => acc + s.percent, 0) + '%')
              }"
            />
            <div class="donut-center">
              <span class="donut-total">{{ donutData.total }}</span>
              <span class="donut-label">всего</span>
            </div>
          </div>
          <div class="donut-legend">
            <div v-for="seg in donutData.segments" :key="seg.label" class="legend-item">
              <span class="legend-dot" :style="{ background: seg.color }" />
              <span>{{ seg.label }} ({{ seg.value }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Столбчатая диаграмма -->
      <div class="chart-card surface-card">
        <h3 class="chart-title">Активность по дням</h3>
        <div class="bar-chart">
          <div v-for="day in barData" :key="day.label" class="bar-col">
            <div class="bar-wrapper">
              <div 
                class="bar-fill"
                :class="{ 'bar-fill--today': day.isToday }"
                :style="{ height: (day.count / maxBarCount) * 100 + '%' }"
              />
            </div>
            <span class="bar-label" :class="{ 'bar-label--today': day.isToday }">
              {{ day.label }}
            </span>
            <span class="bar-count" :class="{ 'bar-count--today': day.isToday }">
              {{ day.count }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== ОСНОВНЫЕ БЛОКИ: ЗАДАЧИ И СОТРУДНИКИ ===== -->
    <div class="detail-grid">
      <section class="surface-card panel">
        <h3 class="panel__title">Задачи отделения</h3>
        <ul v-if="summary.tasks.length" class="task-list">
          <li v-for="t in summary.tasks.slice(0, 10)" :key="t.id">
            <span class="task-list__title">{{ t.title }}</span>
            <StatusTag :status="t.status" />
          </li>
        </ul>
        <EmptyState v-else icon="pi pi-check-square" title="Задач нет" />
      </section>

      <section class="surface-card panel">
        <h3 class="panel__title">Сотрудники</h3>
        <ul v-if="summary.employees.length" class="emp-list">
          <li v-for="e in summary.employees" :key="e.id">
            <HexAvatar 
              :name="e.full_name" 
              :color="e.avatar_color || '#1abc9c'" 
              :size="36" 
            />
            <div class="emp-list__meta">
              <strong>{{ e.full_name }}</strong>
              <span class="muted">{{ e.phone || e.email }}</span>
            </div>
            <span class="dot" :class="e.is_online ? 'dot--on' : 'dot--off'" />
          </li>
        </ul>
        <EmptyState v-else icon="pi pi-users" title="Нет сотрудников" />
      </section>
    </div>

    <TaskFormDialog
      v-if="office.activeOfficeId"
      v-model:visible="taskOpen"
      :office-id="office.activeOfficeId"
      :departments="departments"
      :projects="projects"
      :employees="employees"
      :default-department-id="departmentId"
      @created="load"
    />
  </div>
</template>

<style scoped>
.detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.detail-head h1 { font-size: 26px; }
.detail-head__badge { width: 26px; height: 12px; border-radius: 999px; }

/* ===== KPI ПАНЕЛЬ ===== */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.kpi-card {
  background: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
.kpi-card.full-width {
  grid-column: 1 / -1;
}
.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: #1abc9c;
  font-size: 18px;
}
.kpi-icon.success { background: #81c784; }
.kpi-icon.warning { background: #ffb74d; }
.kpi-icon.danger { background: #e57373; }
.kpi-icon.info { background: #64b5f6; }
.kpi-content {
  display: flex;
  flex-direction: column;
}
.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}
.kpi-label {
  font-size: 13px;
  color: #7f8c8d;
}

/* ===== ГРАФИКИ ===== */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}
.chart-card {
  padding: 20px;
  border-radius: 12px;
}
.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 16px;
}

/* Круговая диаграмма (CSS only) */
.donut-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 10px 0;
}
.donut-chart {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #f0f4f8;
}
.donut-segment {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    from var(--rotation, 0deg),
    var(--color) 0% var(--percent, 0%),
    transparent var(--percent, 0%) 100%
  );
  z-index: 1;
}
.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}
.donut-total { font-size: 20px; font-weight: 700; color: #2c3e50; line-height: 1; }
.donut-label { font-size: 10px; color: #7f8c8d; font-weight: 600; }
.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #2c3e50;
}
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }

/* Столбчатая диаграмма */
.bar-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 140px;
  padding-bottom: 0;
  gap: 8px;
}
.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 4px;
}
.bar-wrapper {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar-fill {
  width: 28px;
  background: #e0f7fa;
  border-radius: 6px 6px 2px 2px;
  transition: height 0.4s ease;
  min-height: 2px;
}
.bar-fill--today {
  background: #1abc9c;
  box-shadow: 0 2px 8px rgba(26, 188, 156, 0.3);
}
.bar-label {
  font-size: 11px;
  color: #7f8c8d;
  font-weight: 600;
}
.bar-label--today { color: #1abc9c; }
.bar-count {
  font-size: 12px;
  font-weight: 700;
  color: #2c3e50;
}
.bar-count--today { color: #1abc9c; }

/* ===== ОСНОВНЫЕ БЛОКИ ===== */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.panel { padding: 22px; }
.panel__title { font-size: 16px; margin-bottom: 16px; }
.task-list, .emp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.task-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--c-surface-2); }
.task-list li:last-child { border-bottom: 0; }
.task-list__title { font-weight: 600; font-size: 14px; }
.emp-list li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--c-surface-2); }
.emp-list li:last-child { border-bottom: 0; }
.emp-list__meta { display: flex; flex-direction: column; line-height: 1.3; flex: 1; }
.emp-list__meta strong { font-size: 14px; }
.emp-list__meta span { font-size: 12px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #e0e0e0; flex-shrink: 0; }
.dot--on { background: #4caf50; }
.dot--off { background: #e0e0e0; }

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 900px) { 
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .charts-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .donut-wrapper { flex-direction: column; gap: 16px; }
}
@media (max-width: 500px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .bar-fill { width: 20px; }
}
</style>