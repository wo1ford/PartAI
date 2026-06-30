<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import type { Department, Employee, Project, Task, TaskPriority, TaskAttachment } from '@/shared/types'
import { TaskApi } from '@/services/tasks.api'

// Импорт API для загрузки файлов (если у тебя есть отдельный FileApi)
// import { FileApi } from '@/services/files.api'

const props = defineProps<{
  officeId: string
  departments: Department[]
  projects: Project[]
  employees: Employee[]
  defaultDepartmentId?: string | null
  prefillStart?: Date | null
  prefillEnd?: Date | null
  task?: Task | null // Для редактирования
}>()

const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ 
  (e: 'created', task: Task): void,
  (e: 'updated', task: Task): void 
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const title = ref('')
const departmentId = ref<string | null>(null)
const projectId = ref<string | null>(null)
const priority = ref<TaskPriority>('medium')
const assigneeIds = ref<string[]>([])
const date = ref<Date>(new Date())
const startTime = ref<Date>(buildTime(10, 0))
const endTime = ref<Date>(buildTime(11, 0))
const description = ref('')
const attachments = ref<TaskAttachment[]>([]) // <--- Хранилище загруженных файлов
const submitted = ref(false)
const saving = ref(false)

const isEditing = computed(() => !!props.task)

const priorityOptions = [
  { label: 'Низкий', value: 'low' },
  { label: 'Средний', value: 'medium' },
  { label: 'Высокий', value: 'high' },
]

function buildTime(h: number, m: number): Date {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

watch(visible, (open) => {
  if (open) {
    // Если открыли для редактирования, заполняем данными
    if (props.task) {
      title.value = props.task.title
      departmentId.value = props.task.department?.id ?? null
      projectId.value = props.task.project?.id ?? null
      priority.value = props.task.priority
      assigneeIds.value = props.task.assignees?.map(a => a.id) ?? []
      date.value = new Date(props.task.starts_at)
      startTime.value = new Date(props.task.starts_at)
      endTime.value = new Date(props.task.ends_at ?? props.task.starts_at)
      description.value = props.task.description ?? ''
      attachments.value = props.task.attachments ?? []
    } else {
      // Новая задача
      const start = props.prefillStart ?? null
      const end = props.prefillEnd ?? null
      title.value = ''
      departmentId.value = props.defaultDepartmentId ?? null
      projectId.value = null
      priority.value = 'medium'
      assigneeIds.value = []
      date.value = start ? new Date(start) : new Date()
      startTime.value = start ? new Date(start) : buildTime(10, 0)
      endTime.value = end ? new Date(end) : buildTime(11, 0)
      description.value = ''
      attachments.value = []
    }
    submitted.value = false
  }
})

function combine(day: Date, time: Date): string {
  const d = new Date(day)
  d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return d.toISOString()
}

// ===== ЗАГРУЗКА ФАЙЛОВ =====
async function handleFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  await uploadFiles(files)
}

async function handleFileDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await uploadFiles(files)
}

async function uploadFiles(files: FileList) {
  uploading.value = true
  try {
    for (const file of files) {
      // 1. Создаем временную локальную ссылку для превью (сразу показываем пользователю, пока грузится)
      const tempId = 'temp_' + Date.now() + '_' + file.name
      attachments.value.push({
        id: tempId,
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file), // Временный URL для браузера
        size: file.size
      })

      // 2. Здесь должен быть реальный вызов API для загрузки на сервер
      // Если у тебя есть FileApi, используй его:
      // const uploaded = await FileApi.upload(props.officeId, file)
      // 
      // 3. После реальной загрузки, заменяем временный объект на реальный, полученный с бэкенда:
      // const idx = attachments.value.findIndex(a => a.id === tempId)
      // if (idx !== -1) attachments.value[idx] = uploaded
    }
    toast.add({ severity: 'success', summary: 'Файлы добавлены', life: 2000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось загрузить файлы', life: 3000 })
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = '' // Очищаем input
  }
}

function removeAttachment(id: string) {
  const idx = attachments.value.findIndex(a => a.id === id)
  if (idx !== -1) {
    // Если это временный файл с blob URL, отзываем его, чтобы не забивать память
    if (attachments.value[idx].url.startsWith('blob:')) {
      URL.revokeObjectURL(attachments.value[idx].url)
    }
    attachments.value.splice(idx, 1)
  }
}

// ===== СОЗДАНИЕ / СОХРАНЕНИЕ =====
async function submit(): Promise<void> {
  submitted.value = true
  if (!title.value.trim()) return
  saving.value = true
  try {
    const data = {
      title: title.value.trim(),
      description: description.value.trim() || null,
      starts_at: combine(date.value, startTime.value),
      ends_at: combine(date.value, endTime.value),
      department_id: departmentId.value,
      project_id: projectId.value,
      priority: priority.value,
      assignee_ids: assigneeIds.value,
      attachments: attachments.value // Передаем файлы
    }

    if (isEditing.value && props.task) {
      const updated = await TaskApi.update(props.task.id, data)
      emit('updated', updated)
      toast.add({ severity: 'success', summary: 'Задача обновлена', life: 2500 })
    } else {
      const created = await TaskApi.create(props.officeId, data)
      emit('created', created)
      toast.add({ severity: 'success', summary: 'Задача создана', detail: created.title, life: 2500 })
    }
    visible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog 
    v-model:visible="visible" 
    modal 
    :header="isEditing ? 'Редактировать задачу' : 'Новая задача'" 
    :style="{ width: '560px' }"
  >
    <div class="form">
      <div class="field">
        <label>Название</label>
        <InputText v-model="title" placeholder="Например: Планерка офис" fluid />
        <Message v-if="submitted && !title.trim()" severity="error" size="small" variant="simple">
          Укажите название
        </Message>
      </div>

      <div class="grid-2">
        <div class="field">
          <label>Отделение</label>
          <Select
            v-model="departmentId"
            :options="departments"
            option-label="name"
            option-value="id"
            placeholder="Не выбрано"
            show-clear
            fluid
          />
        </div>
        <div class="field">
          <label>Проект</label>
          <Select
            v-model="projectId"
            :options="projects"
            option-label="name"
            option-value="id"
            placeholder="Не выбрано"
            show-clear
            fluid
          />
        </div>
      </div>

      <div class="grid-3">
        <div class="field">
          <label>Дата</label>
          <DatePicker v-model="date" date-format="dd.mm.yy" fluid />
        </div>
        <div class="field">
          <label>Начало</label>
          <DatePicker v-model="startTime" time-only fluid />
        </div>
        <div class="field">
          <label>Конец</label>
          <DatePicker v-model="endTime" time-only fluid />
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label>Приоритет</label>
          <Select v-model="priority" :options="priorityOptions" option-label="label" option-value="value" fluid>
            <template #option="slotProps">
              <span :class="['badge', 'badge--priority', 'badge--' + slotProps.option.value]">
                {{ slotProps.option.label }}
              </span>
            </template>
          </Select>
        </div>
        <div class="field">
          <label>Исполнители</label>
          <MultiSelect
            v-model="assigneeIds"
            :options="employees"
            option-label="full_name"
            option-value="id"
            placeholder="Выбрать"
            :max-selected-labels="2"
            fluid
          />
        </div>
      </div>

      <div class="field">
        <label>Описание</label>
        <Textarea v-model="description" rows="2" auto-resize fluid />
      </div>

      <!-- ===== ЗОНА ЗАГРУЗКИ ФАЙЛОВ ===== -->
      <div class="field">
        <label>Прикрепить файлы</label>
        <div 
          class="file-drop-zone" 
          @dragover.prevent 
          @drop.prevent="handleFileDrop"
          @click="fileInput?.click()"
        >
          <i class="pi pi-cloud-upload" />
          <p>Перетащите файлы или нажмите для выбора</p>
          <input 
            type="file" 
            multiple 
            hidden 
            ref="fileInput" 
            @change="handleFileSelect"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" 
          />
          <Button type="button" label="Выбрать файлы" text size="small" />
        </div>
        
        <!-- Список загруженных файлов -->
        <div v-if="attachments.length > 0" class="file-list">
          <div v-for="file in attachments" :key="file.id" class="file-item">
            <div class="file-item__info">
              <i v-if="file.type.startsWith('image')" class="pi pi-image" />
              <i v-else-if="file.type.startsWith('video')" class="pi pi-video" />
              <i v-else class="pi pi-paperclip" />
              <span>{{ file.name }}</span>
              <span v-if="file.size" class="file-size">({{ (file.size / 1024).toFixed(0) }} KB)</span>
            </div>
            <i class="pi pi-times file-item__remove" @click="removeAttachment(file.id)" />
          </div>
        </div>
        <div v-if="uploading" class="uploading-indicator">
          <i class="pi pi-spin pi-spinner" /> Загрузка...
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" text @click="visible = false" />
      <Button 
        :label="isEditing ? 'Сохранить' : 'Создать'" 
        icon="pi pi-check" 
        :loading="saving || uploading" 
        @click="submit" 
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 16px; padding-top: 4px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 600; color: var(--c-text-muted); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid-3 { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; }

/* Стили для зоны загрузки */
.file-drop-zone {
  border: 2px dashed #d0d7de;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.file-drop-zone:hover {
  border-color: var(--c-primary);
  background: var(--c-primary-050);
}
.file-drop-zone i { font-size: 32px; color: var(--c-text-muted); }
.file-drop-zone p { font-size: 13px; color: var(--c-text-muted); margin: 0; }

.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  max-height: 150px;
  overflow-y: auto;
}
.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #eef2f6;
}
.file-item__info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  overflow: hidden;
}
.file-item__info i { color: var(--c-primary); }
.file-item__info span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { color: var(--c-text-muted); font-size: 11px; }
.file-item__remove {
  color: #95a5a6;
  cursor: pointer;
  transition: 0.2s;
}
.file-item__remove:hover { color: #e74c3c; }

.uploading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--c-text-muted);
  margin-top: 4px;
}
.uploading-indicator i { color: var(--c-primary); }

/* Приоритеты в выпадающем списке */
.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.badge--priority.badge--high { background: #f8d7da; color: #721c24; }
.badge--priority.badge--medium { background: #fff3cd; color: #856404; }
.badge--priority.badge--low { background: #d1ecf1; color: #0c5460; }
</style>