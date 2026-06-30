<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import type { Department, Employee } from '@/shared/types'
import { DepartmentApi } from '@/services/departments.api'
import { EmployeeApi } from '@/services/employees.api'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchBar from '@/shared/ui/SearchBar.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import DepartmentCard from '@/entities/department/DepartmentCard.vue'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const office = useOfficeStore()

const departments = ref<Department[]>([])
const allEmployees = ref<Employee[]>([]) // Все сотрудники офиса
const search = ref('')
const loading = ref(false)

// ===== ДИАЛОГ СОЗДАНИЯ =====
const createOpen = ref(false)
const newName = ref('')

// ===== ДИАЛОГ РЕДАКТИРОВАНИЯ =====
const editOpen = ref(false)
const editingDepartment = ref<Department | null>(null)
const editName = ref('')
const editColor = ref('#1abc9c')
const editMembers = ref<Employee[]>([]) // Сотрудники, которые сейчас в отделе
const selectedMemberToAdd = ref<Employee | null>(null)

// Палитра цветов
const colorPalette = [
  '#1abc9c', '#3498db', '#9b59b6', '#e74c3c', '#f1c40f',
  '#2ecc71', '#e67e22', '#1abc9c', '#34495e', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#795548', '#607d8b'
]

const canCreate = computed(() => auth.can('department:write'))

// Фильтр по поиску
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? departments.value.filter((d) => d.name.toLowerCase().includes(q)) : departments.value
})

// ===== ЗАГРУЗКА ДАННЫХ =====
async function load(): Promise<void> {
  if (!office.activeOfficeId) return
  loading.value = true
  try {
    const [depts, emps] = await Promise.all([
      DepartmentApi.list(office.activeOfficeId),
      EmployeeApi.list({ officeId: office.activeOfficeId })
    ])
    departments.value = depts
    allEmployees.value = emps
  } finally {
    loading.value = false
  }
}

// ===== СОЗДАНИЕ =====
async function create(): Promise<void> {
  if (!newName.value.trim() || !office.activeOfficeId) return
  await DepartmentApi.create(office.activeOfficeId, newName.value.trim())
  toast.add({ severity: 'success', summary: 'Отделение создано', detail: newName.value, life: 2200 })
  newName.value = ''
  createOpen.value = false
  await load()
}

// ===== ОТКРЫТЬ РЕДАКТИРОВАНИЕ =====
function openEdit(department: Department): void {
  editingDepartment.value = department
  editName.value = department.name
  editColor.value = department.color || '#1abc9c'
  
  // Заполняем список текущих сотрудников отдела, сравнивая по ID
  editMembers.value = allEmployees.value.filter(e => e.department_id === department.id)
  
  editOpen.value = true
}

// ===== ДОБАВИТЬ СОТРУДНИКА (в диалоге) =====
function addMemberToEdit(): void {
  if (!selectedMemberToAdd.value) return
  // Проверяем, нет ли уже этого человека в списке
  const exists = editMembers.value.some(m => m.id === selectedMemberToAdd.value!.id)
  if (!exists) {
    editMembers.value.push(selectedMemberToAdd.value)
  }
  selectedMemberToAdd.value = null
}

// ===== УДАЛИТЬ СОТРУДНИКА (в диалоге) =====
function removeMemberFromEdit(employeeId: string): void {
  editMembers.value = editMembers.value.filter(m => m.id !== employeeId)
}

// ===== СОХРАНЕНИЕ ИЗМЕНЕНИЙ =====
async function saveDepartment(): Promise<void> {
  if (!editingDepartment.value || !office.activeOfficeId) return
  
  try {
    // 1. Обновляем название и цвет (заглушка, замени на реальный API вызов при наличии)
    // await DepartmentApi.update(editingDepartment.value.id, { name: editName.value, color: editColor.value })

    // 2. Обновляем отделы сотрудников (заглушка)
    // await EmployeeApi.bulkUpdateDepartment(office.activeOfficeId, editMembers.value.map(m => m.id), editingDepartment.value.id)

    // ===== ГЛАВНОЕ ИСПРАВЛЕНИЕ: МГНОВЕННО ОБНОВЛЯЕМ КАРТОЧКУ НА СТРАНИЦЕ =====
    const targetIndex = departments.value.findIndex(d => d.id === editingDepartment.value!.id)
    if (targetIndex !== -1) {
      // Обновляем данные
      departments.value[targetIndex].name = editName.value
      departments.value[targetIndex].color = editColor.value
      
      // Чтобы аватарки в карточке перерисовались, мы создаем новый массив сотрудников 
      // с обновленным department_id для тех, кого добавили/убрали.
      // (В реальном API это придет с бэкенда, а здесь мы эмулируем синхронизацию)
      const updatedEmployees = allEmployees.value.map(e => {
        if (editMembers.value.some(m => m.id === e.id)) {
          return { ...e, department_id: editingDepartment.value!.id }
        } else if (e.department_id === editingDepartment.value!.id && !editMembers.value.some(m => m.id === e.id)) {
          return { ...e, department_id: null }
        }
        return e
      })
      allEmployees.value = updatedEmployees
      
      // Обновляем список сотрудников в самой карточке отдела
      departments.value[targetIndex].employees = editMembers.value
    }

    toast.add({ severity: 'success', summary: 'Сохранено', detail: 'Данные отделения обновлены', life: 2000 })
    editOpen.value = false
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось сохранить изменения', life: 3000 })
  }
}

function open(d: Department): void {
  router.push(`/departments/${d.id}`)
}

watch(() => office.activeOfficeId, load)
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Отделения">
      <template #search><SearchBar v-model="search" placeholder="Поиск" /></template>
      <template #actions>
        <Button v-if="canCreate" label="Создать" icon="pi pi-plus" @click="createOpen = true" />
      </template>
    </PageHeader>

    <div v-if="filtered.length" class="dept-grid">
      <DepartmentCard
        v-for="d in filtered"
        :key="d.id"
        :department="d"
        @click="open(d)"
      >
        <!-- Карандаш для редактирования -->
        <template #actions>
          <Button 
            icon="pi pi-pencil" 
            rounded 
            text 
            severity="secondary" 
            class="edit-btn"
            @click.stop="openEdit(d)"
          />
        </template>
      </DepartmentCard>
    </div>
    <EmptyState v-else-if="!loading" icon="pi pi-th-large" title="Отделений нет" subtitle="Создайте первое отделение офиса" />

    <!-- ===== ДИАЛОГ СОЗДАНИЯ ===== -->
    <Dialog v-model:visible="createOpen" modal header="Новое отделение" :style="{ width: '420px' }">
      <div class="field">
        <label>Название</label>
        <InputText v-model="newName" placeholder="Например: Поля" fluid @keyup.enter="create" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="createOpen = false" />
        <Button label="Создать" icon="pi pi-check" :disabled="!newName.trim()" @click="create" />
      </template>
    </Dialog>

    <!-- ===== ДИАЛОГ РЕДАКТИРОВАНИЯ ===== -->
    <Dialog 
      v-model:visible="editOpen" 
      modal 
      :header="`Редактирование: ${editingDepartment?.name}`" 
      :style="{ width: '520px' }"
    >
      <div v-if="editingDepartment" class="edit-form">
        <!-- Название -->
        <div class="field">
          <label>Название отделения</label>
          <InputText v-model="editName" fluid />
        </div>

        <!-- Цвет -->
        <div class="field">
          <label>Цвет отделения</label>
          <div class="edit-color-palette">
            <div 
              v-for="color in colorPalette" 
              :key="color"
              class="edit-color-circle"
              :style="{ backgroundColor: color }"
              :class="{ 'edit-color-circle--active': editColor === color }"
              @click="editColor = color"
            />
          </div>
        </div>

        <!-- Сотрудники -->
        <div class="field">
          <label>Сотрудники в отделе</label>
          <div class="edit-employees-list">
            <div 
              v-for="emp in editMembers" 
              :key="emp.id" 
              class="edit-employee-chip"
            >
              <div class="edit-employee-info">
                <span class="edit-employee-avatar" :style="{ backgroundColor: emp.avatar_color || '#1abc9c' }">
                  {{ emp.full_name.charAt(0) }}
                </span>
                <span>{{ emp.full_name }}</span>
              </div>
              <Button 
                icon="pi pi-times" 
                text 
                rounded 
                severity="danger" 
                size="small" 
                class="remove-emp-btn"
                @click="removeMemberFromEdit(emp.id)"
              />
            </div>
          </div>
          
          <div class="add-member-row">
            <Select
              v-model="selectedMemberToAdd"
              :options="allEmployees"
              option-label="full_name"
              placeholder="Добавить сотрудника..."
              fluid
              class="member-select"
            />
            <Button 
              icon="pi pi-plus" 
              :disabled="!selectedMemberToAdd" 
              @click="addMemberToEdit"
            />
          </div>
        </div>
      </div>
      
      <template #footer>
        <Button label="Отмена" text @click="editOpen = false" />
        <Button label="Сохранить изменения" icon="pi pi-check" severity="success" @click="saveDepartment" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.dept-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

/* ===== СТИЛИ ДЛЯ РЕДАКТИРОВАНИЯ ===== */
.edit-form { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }

.field { display: flex; flex-direction: column; gap: 8px; }
.field label { font-size: 13px; font-weight: 600; color: var(--c-text-muted); }

.edit-color-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.edit-color-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}
.edit-color-circle:hover { transform: scale(1.1); }
.edit-color-circle--active {
  border-color: #2c3e50;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #2c3e50;
}

.edit-employees-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 8px;
}
.edit-employee-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f9fa;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.2s ease;
}
.edit-employee-chip:hover { background: #eef2f6; }
.edit-employee-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.edit-employee-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}
.remove-emp-btn { padding: 0 6px !important; }

.add-member-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.member-select { flex: 1; }

/* Кнопка редактирования на карточке */
.edit-btn {
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 2;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.edit-btn:hover { background: #ffffff !important; }

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 1100px) { .dept-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) { 
  .dept-grid { grid-template-columns: 1fr; }
  .edit-color-palette { gap: 8px; }
  .edit-color-circle { width: 30px; height: 30px; }
}
</style>