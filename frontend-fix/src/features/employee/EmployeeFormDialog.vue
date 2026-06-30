<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import type { Department, Employee, UserRole } from '@/shared/types'
import { EmployeeApi } from '@/services/employees.api'

const props = defineProps<{ officeId: string; departments: Department[]; employee?: Employee | null }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ (e: 'saved'): void }>()

const toast = useToast()

const fullName = ref('')
const email = ref('')
const phone = ref('')
const role = ref<UserRole>('employee')
const departmentIds = ref<string[]>([])
const password = ref('')
const submitted = ref(false)
const saving = ref(false)

const roleOptions = [
  { label: 'Сотрудник', value: 'employee' },
  { label: 'Руководитель офиса', value: 'office_manager' },
]

watch(visible, (open) => {
  if (!open) return
  submitted.value = false
  const e = props.employee
  fullName.value = e?.full_name ?? ''
  email.value = e?.email ?? ''
  phone.value = e?.phone ?? ''
  role.value = e?.role === 'admin' ? 'employee' : (e?.role ?? 'employee')
  departmentIds.value = e?.departments.map((d) => d.id) ?? []
  password.value = ''
})

function valid(): boolean {
  return Boolean(fullName.value.trim() && email.value.trim())
}

async function submit(): Promise<void> {
  submitted.value = true
  if (!valid()) return
  saving.value = true
  try {
    const payload = {
      full_name: fullName.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim() || null,
      role: role.value,
      department_ids: departmentIds.value,
      password: password.value || undefined,
    }
    if (props.employee) {
      await EmployeeApi.update(props.employee.id, payload)
      toast.add({ severity: 'success', summary: 'Сотрудник обновлён', life: 2200 })
    } else {
      await EmployeeApi.create(props.officeId, payload)
      toast.add({ severity: 'success', summary: 'Сотрудник добавлен', life: 2200 })
    }
    emit('saved')
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
    :header="employee ? 'Редактировать сотрудника' : 'Новый сотрудник'"
    :style="{ width: '480px' }"
  >
    <div class="form">
      <div class="field">
        <label>ФИО</label>
        <InputText v-model="fullName" placeholder="Иван Иванов" fluid />
        <Message v-if="submitted && !fullName.trim()" severity="error" size="small" variant="simple">Укажите ФИО</Message>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Email</label>
          <InputText v-model="email" placeholder="name@party.ru" fluid />
          <Message v-if="submitted && !email.trim()" severity="error" size="small" variant="simple">Укажите email</Message>
        </div>
        <div class="field">
          <label>Телефон</label>
          <InputText v-model="phone" placeholder="+7 ..." fluid />
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Роль</label>
          <Select v-model="role" :options="roleOptions" option-label="label" option-value="value" fluid />
        </div>
        <div class="field">
          <label>Отделения</label>
          <MultiSelect
            v-model="departmentIds"
            :options="departments"
            option-label="name"
            option-value="id"
            placeholder="Выбрать"
            :max-selected-labels="2"
            fluid
          />
        </div>
      </div>
      <div v-if="!employee" class="field">
        <label>Временный пароль</label>
        <Password v-model="password" :feedback="false" toggle-mask fluid placeholder="••••••" />
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" text @click="visible = false" />
      <Button label="Сохранить" icon="pi pi-check" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 16px; padding-top: 4px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 600; color: var(--c-text-muted); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
</style>
