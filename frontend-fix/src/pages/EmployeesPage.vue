<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { Department, Employee } from '@/shared/types'
import { EmployeeApi } from '@/services/employees.api'
import { DepartmentApi } from '@/services/departments.api'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchBar from '@/shared/ui/SearchBar.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import EmployeeFormDialog from '@/features/employee/EmployeeFormDialog.vue'

const auth = useAuthStore()
const office = useOfficeStore()
const confirm = useConfirm()
const toast = useToast()

const employees = ref<Employee[]>([])
const departments = ref<Department[]>([])
const search = ref('')
const dialogOpen = ref(false)
const editing = ref<Employee | null>(null)

const canManage = computed(() => auth.can('employee:write'))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? employees.value.filter((e) => `${e.full_name} ${e.email}`.toLowerCase().includes(q))
    : employees.value
})

// Получить название отдела по ID
const getDepartmentName = (departmentId: string | null | undefined): string => {
  if (!departmentId) return '—'
  const dept = departments.value.find(d => d.id === departmentId)
  return dept?.name || '—'
}

// Проверка, является ли сотрудник администратором или самим собой
const isProtectedUser = (employee: Employee): boolean => {
  if (!auth.user) return false
  // Нельзя удалить самого себя
  if (employee.id === auth.user.id) return true
  // Нельзя удалить пользователя с ролью администратора
  if (employee.role === 'admin') return true
  return false
}

async function load(): Promise<void> {
  if (!office.activeOfficeId) return
  const [emps, deps] = await Promise.all([
    EmployeeApi.list({ officeId: office.activeOfficeId }),
    DepartmentApi.list(office.activeOfficeId),
  ])
  employees.value = emps
  departments.value = deps
}

function add(): void {
  editing.value = null
  dialogOpen.value = true
}

function edit(employee: Employee): void {
  editing.value = employee
  dialogOpen.value = true
}

function remove(employee: Employee): void {
  if (isProtectedUser(employee)) {
    toast.add({ 
      severity: 'warn', 
      summary: 'Действие запрещено', 
      detail: 'Администратора или самого себя удалить нельзя', 
      life: 3000 
    })
    return
  }

  confirm.require({
    message: `Удалить сотрудника «${employee.full_name}»?`,
    header: 'Удаление',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await EmployeeApi.remove(employee.id)
      toast.add({ severity: 'success', summary: 'Сотрудник удалён', life: 2000 })
      await load()
    },
  })
}

watch(() => office.activeOfficeId, load)
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Сотрудники">
      <template #search><SearchBar v-model="search" placeholder="Поиск" /></template>
      <template #actions>
        <Button v-if="canManage" label="Добавить" icon="pi pi-plus" @click="add" />
      </template>
    </PageHeader>

    <div v-if="filtered.length" class="emp-grid">
      <div 
        v-for="e in filtered" 
        :key="e.id" 
        class="employee-card"
        :class="{ 'employee-card--admin': isProtectedUser(e) }"
        :style="{ '--accent-color': e.avatar_color || '#1abc9c' }"
      >
        <!-- Акцентная цветная полоса сверху -->
        <div class="emp-card__accent"></div>
        
        <!-- Бейдж администратора -->
        <div v-if="isProtectedUser(e)" class="emp-card__badge">
          <i class="pi pi-shield"></i> Администратор
        </div>
        
        <!-- Кнопки действий (в правом верхнем углу как в DepartmentCard) -->
        <div v-if="canManage" class="emp-card__actions">
          <Button 
            icon="pi pi-pencil" 
            rounded 
            text 
            severity="secondary" 
            size="small"
            class="action-btn" 
            @click.stop="edit(e)"
          />
          
          <!-- Кнопка удаления (не показываем для админа/себя) -->
          <Button 
            v-if="!isProtectedUser(e)"
            icon="pi pi-trash" 
            rounded 
            text 
            severity="danger" 
            size="small"
            class="action-btn" 
            @click.stop="remove(e)"
          />
          
          <!-- Блокировка удаления для админа -->
          <Button 
            v-else
            icon="pi pi-lock" 
            rounded 
            text 
            severity="secondary" 
            size="small"
            class="action-btn locked"
            disabled
          />
        </div>

        <!-- Аватар -->
        <div class="emp-card__avatar-wrapper">
          <div class="emp-card__avatar" :style="{ backgroundColor: e.avatar_color || '#1abc9c' }">
            {{ e.full_name.charAt(0) }}
          </div>
        </div>

        <!-- ФИО -->
        <div class="emp-card__name">{{ e.full_name }}</div>

        <!-- Отдел -->
        <div class="emp-card__dept">
          {{ getDepartmentName(e.department_id) }}
        </div>

        <!-- Контакты -->
        <div class="emp-card__contacts">
          <div v-if="e.email" class="contact-item">
            <i class="pi pi-envelope" />
            <span>{{ e.email }}</span>
          </div>
          <div v-if="e.phone" class="contact-item">
            <i class="pi pi-phone" />
            <span>{{ e.phone }}</span>
          </div>
          <div v-if="!e.email && !e.phone" class="contact-item muted">
            <span>Нет контактов</span>
          </div>
        </div>
      </div>
    </div>
    
    <EmptyState v-else icon="pi pi-users" title="Сотрудники не найдены" subtitle="Измените запрос или добавьте сотрудника" />

    <EmployeeFormDialog
      v-if="office.activeOfficeId"
      v-model:visible="dialogOpen"
      :office-id="office.activeOfficeId"
      :departments="departments"
      :employee="editing"
      @saved="load"
    />
  </div>
</template>

<style scoped>
/* ===== СЕТКА (Аналогично DepartmentsPage) ===== */
.emp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

/* ===== КАРТОЧКА СОТРУДНИКА (в стиле DepartmentCard) ===== */
.employee-card {
  position: relative;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #eef2f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  padding: 28px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  cursor: default;
}
.employee-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.06);
  border-color: #e0e7ef;
}

/* ===== СТИЛЬ ДЛЯ ЗАЩИЩЁННОГО АДМИНА ===== */
.employee-card--admin {
  background: #f8fafc;
  border-color: #dbeafe;
}
.employee-card--admin .emp-card__accent {
  background: #3b82f6 !important;
}
.employee-card--admin .emp-card__badge {
  display: flex;
}

/* ===== БЕЙДЖ АДМИНИСТРАТОРА ===== */
.emp-card__badge {
  display: none;
  position: absolute;
  top: 12px;
  left: 12px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  align-items: center;
  gap: 6px;
  z-index: 2;
}
.emp-card__badge i { font-size: 13px; }

/* ===== АКЦЕНТНАЯ ПОЛОСА СВЕРХУ ===== */
.emp-card__accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-color, #1abc9c);
  border-radius: 16px 16px 0 0;
}

/* ===== КНОПКИ ДЕЙСТВИЙ ===== */
.emp-card__actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  z-index: 2;
}
.action-btn {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
}
.action-btn:hover {
  background: #ffffff !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.action-btn.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== АВАТАР ===== */
.emp-card__avatar-wrapper {
  margin-bottom: 12px;
}
.emp-card__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

/* ===== ТЕКСТОВЫЕ ДАННЫЕ ===== */
.emp-card__name {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
  text-align: center;
}
.emp-card__dept {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 12px;
  text-align: center;
}

/* ===== КОНТАКТЫ ===== */
.emp-card__contacts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}
.contact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
  justify-content: center;
}
.contact-item i {
  color: #94a3b8;
  font-size: 14px;
}
.contact-item.muted {
  color: #94a3b8;
  font-size: 13px;
}

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 1100px) { 
  .emp-grid { grid-template-columns: repeat(2, 1fr); } 
}
@media (max-width: 720px) { 
  .emp-grid { grid-template-columns: 1fr; }
  .employee-card { padding: 20px 16px; }
  .emp-card__avatar { width: 52px; height: 52px; font-size: 20px; }
}
</style>