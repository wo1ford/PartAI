<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import type { UserRole } from '@/shared/types'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

const email = ref('yuri@party.ru')
const password = ref('demo')

const demoRoles: { role: UserRole; label: string; icon: string }[] = [
  { role: 'admin', label: 'Админ', icon: 'pi pi-shield' },
  { role: 'office_manager', label: 'Руководитель', icon: 'pi pi-briefcase' },
  { role: 'employee', label: 'Сотрудник', icon: 'pi pi-user' },
]

async function submit(): Promise<void> {
  await auth.login(email.value, password.value)
  router.push('/dashboard')
}

async function quick(role: UserRole): Promise<void> {
  await auth.loginAs(role)
  router.push('/dashboard')
}
</script>

<template>
  <div class="login">
    <h1>Вход в систему</h1>
    <p class="muted">Войдите, чтобы продолжить работу</p>

    <form class="login__form" @submit.prevent="submit">
      <div class="field">
        <label>Email</label>
        <InputText v-model="email" placeholder="name@party.ru" fluid autocomplete="username" />
      </div>
      <div class="field">
        <label>Пароль</label>
        <Password v-model="password" :feedback="false" toggle-mask fluid input-class="w-full" />
      </div>
      <Button type="submit" label="Войти" icon="pi pi-arrow-right" icon-pos="right" :loading="auth.loading" fluid />
    </form>

    <div class="login__demo">
      <span class="muted">Быстрый демо-вход по роли</span>
      <div class="login__demo-row">
        <Button
          v-for="r in demoRoles"
          :key="r.role"
          :label="r.label"
          :icon="r.icon"
          severity="secondary"
          outlined
          size="small"
          @click="quick(r.role)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login { width: 100%; max-width: 360px; }
.login h1 { font-size: 26px; }
.login > .muted { margin-bottom: 26px; }
.login__form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 600; color: var(--c-text-muted); }
.field :deep(.p-password) { width: 100%; }
.field :deep(.p-password input) { width: 100%; }
.login__demo { margin-top: 28px; display: flex; flex-direction: column; gap: 10px; text-align: center; }
.login__demo-row { display: flex; gap: 8px; justify-content: center; }
</style>
