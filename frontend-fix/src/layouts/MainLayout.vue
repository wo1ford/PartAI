<script setup lang="ts">
import { ref } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import SidebarNav from '@/widgets/SidebarNav.vue'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'

const auth = useAuthStore()
const office = useOfficeStore()

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  office_manager: 'Руководитель офиса',
  employee: 'Сотрудник',
}

const notifPanel = ref<InstanceType<typeof Popover>>()
const notifications = [
  { icon: 'pi pi-calendar', text: 'Новая задача «Согласование ролика» назначена на завтра' },
  { icon: 'pi pi-inbox', text: 'Анастасия загрузила автопробег.mp4' },
  { icon: 'pi pi-user-plus', text: 'Добавлен сотрудник в отделение «Поля»' },
]

function toggleNotif(event: Event): void {
  notifPanel.value?.toggle(event)
}
</script>

<template>
  <div class="app">
    <SidebarNav />

    <div class="app__main">
      <div class="app__topbar">
        <Select
          v-if="office.canSwitch"
          :model-value="office.selectedId"
          :options="office.offices"
          option-label="name"
          option-value="id"
          class="office-select"
          @update:model-value="office.select($event)"
        />
        <div class="grow" />

        <Button
          class="bell"
          icon="pi pi-bell"
          rounded
          text
          aria-label="Уведомления"
          @click="toggleNotif"
        />
        <Popover ref="notifPanel">
          <div class="notif">
            <strong class="notif__title">Уведомления</strong>
            <div v-for="(n, i) in notifications" :key="i" class="notif__item">
              <i :class="n.icon" />
              <span>{{ n.text }}</span>
            </div>
          </div>
        </Popover>

        <div v-if="auth.user" class="user-chip">
          <HexAvatar :name="auth.user.full_name" :color="auth.user.avatar_color" :size="38" />
          <div class="user-chip__meta">
            <strong>{{ auth.user.full_name }}</strong>
            <span class="muted">{{ ROLE_LABEL[auth.user.role] }}</span>
          </div>
        </div>
      </div>

      <main class="app__content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app { min-height: 100vh; }
.app__main { margin-left: var(--side-w); display: flex; flex-direction: column; min-height: 100vh; }
.app__topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 32px; height: 72px;
}
.office-select { min-width: 200px; }
.bell { position: relative; }
.bell::after { content: ''; position: absolute; top: 8px; right: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--c-danger); border: 2px solid var(--c-bg); }
.user-chip { display: flex; align-items: center; gap: 10px; padding: 4px 6px 4px 4px; }
.user-chip__meta { display: flex; flex-direction: column; line-height: 1.2; }
.user-chip__meta strong { font-size: 13px; }
.user-chip__meta span { font-size: 11px; }
.app__content { flex: 1; padding: 8px 32px 40px; }

.notif { width: 300px; display: flex; flex-direction: column; gap: 4px; }
.notif__title { display: block; margin-bottom: 6px; }
.notif__item { display: flex; gap: 10px; padding: 10px 8px; border-radius: 10px; font-size: 13px; }
.notif__item:hover { background: var(--c-surface); }
.notif__item i { color: var(--c-primary); margin-top: 2px; }
</style>
