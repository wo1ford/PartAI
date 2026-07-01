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

    <div v-if="filtered.length" class="employees-container">
      <div 
        v-for="e in filtered" 
        :key="e.id" 
        class="employee-row"
        :class="{ 'employee-row--admin': isProtectedUser(e) }"
      >
        <!-- Аватар -->
        <div class="emp-avatar" :style="{ backgroundColor: e.avatar_color || '#1abc9c' }">
          {{ e.full_name.charAt(0) }}
        </div>

        <!-- Информация о сотруднике -->
        <div class="emp-info">
          <div class="emp-name-wrapper">
            <span class="emp-name">{{ e.full_name }}</span>
            
            <!-- Бейдж администратора (компактный) -->
            <span v-if="isProtectedUser(e)" class="emp-badge">
              <i class="pi pi-shield"></i> Администратор
            </span>
          </div>
          
          <div class="emp-details">
            <span class="emp-dept">{{ getDepartmentName(e.department_id) }}</span>
            <span v-if="e.email" class="emp-contact">
              <i class="pi pi-envelope"></i> {{ e.email }}
            </span>
            <span v-if="e.phone" class="emp-contact">
              <i class="pi pi-phone"></i> {{ e.phone }}
            </span>
          </div>
        </div>

        <!-- Действия (всегда справа) -->
        <div class="emp-actions">
          <Button 
            v-if="canManage"
            icon="pi pi-pencil" 
            rounded 
            text 
            severity="secondary" 
            size="small"
            class="action-btn" 
            @click.stop="edit(e)"
          />
          
          <Button 
            v-if="canManage && !isProtectedUser(e)"
            icon="pi pi-trash" 
            rounded 
            text 
            severity="danger" 
            size="small"
            class="action-btn" 
            @click.stop="remove(e)"
          />
          
          <Button 
            v-if="canManage && isProtectedUser(e)"
            icon="pi pi-lock" 
            rounded 
            text 
            severity="secondary" 
            size="small"
            class="action-btn locked"
            disabled
          />
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
/* ===== КОНТЕЙНЕР ===== */
.employees-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

/* ===== СТРОКА СОТРУДНИКА (Modern Clean Look) ===== */
.employee-row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  padding: 14px 20px;
  border-radius: 12px;
  border: 1px solid #f0f4f8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.employee-row:hover {
  border-color: #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

/* ===== АВАТАР ===== */
.emp-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* ===== ИНФОРМАЦИЯ (ФИО + Отдел + Контакты) ===== */
.emp-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.emp-name-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.emp-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}
.emp-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #7f8c8d;
}
.emp-dept {
  background: #f1f5f9;
  padding: 2px 10px;
  border-radius: 20px;
  font-weight: 500;
  color: #334155;
}
.emp-contact {
  display: flex;
  align-items: center;
  gap: 4px;
}
.emp-contact i {
  font-size: 13px;
  color: #94a3b8;
}

/* ===== БЕЙДЖ АДМИНИСТРАТОРА ===== */
.emp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}

/* ===== КНОПКИ ДЕЙСТВИЙ ===== */
.emp-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.action-btn {
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
}
.employee-row:hover .action-btn {
  opacity: 1;
}
.action-btn:hover {
  background: #f1f5f9 !important;
}
.action-btn.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 720px) {
  .employee-row {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
    gap: 12px;
  }
  .emp-avatar {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
  .emp-info {
    width: 100%;
  }
  .emp-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .emp-actions {
    width: 100%;
    justify-content: flex-end;
    border-top: 1px solid #f0f4f8;
    padding-top: 10px;
    margin-top: 4px;
  }
  .action-btn {
    opacity: 1;
  }
}
</style>