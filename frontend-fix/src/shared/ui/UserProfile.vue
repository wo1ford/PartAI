<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import HexAvatar from './HexAvatar.vue' // Импортируем твой аватар

const router = useRouter()
const menu = ref()

// Список пунктов меню
const items = ref<MenuItem[]>([
  {
    label: 'Профиль',
    icon: 'pi pi-user',
    command: () => {
      router.push('/profile')
    }
  },
  {
    label: 'Настройки',
    icon: 'pi pi-cog',
    command: () => {
      router.push('/settings')
    }
  },
  {
    separator: true
  },
  {
    label: 'Выход',
    icon: 'pi pi-sign-out',
    command: () => {
      // Здесь логика выхода (очистка токенов, переход на логин)
      console.log('Выход из системы')
      router.push('/login')
    }
  }
])

// Данные пользователя (в реальном проекте брать из стора)
const user = {
  name: 'Диана Нестерова',
  role: 'Сотрудник',
  initials: 'ДН',
  avatarColor: '#1abc9c'
}
</script>

<template>
  <div class="user-profile">
    <!-- Кнопка уведомлений -->
    <Button 
      icon="pi pi-bell" 
      rounded 
      text 
      severity="secondary" 
      class="notification-btn"
      aria-label="Уведомления"
    />
    
    <!-- Область клика для вызова меню -->
    <div class="profile-trigger" @click="menu.toggle($event)">
      <!-- Аватар -->
      <HexAvatar 
        :name="user.name" 
        :initials="user.initials" 
        :color="user.avatarColor" 
        :size="40" 
      />
      
      <!-- Текстовая информация -->
      <div class="profile-info">
        <span class="profile-name">{{ user.name }}</span>
        <span class="profile-role">{{ user.role }}</span>
      </div>
    </div>

    <!-- Выпадающее меню -->
    <Menu ref="menu" :model="items" :popup="true" class="profile-menu" />
  </div>
</template>

<style scoped>
.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}
.notification-btn {
  color: #1abc9c !important;
}
.notification-btn:hover {
  background: #e0f7fa !important;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 12px;
  transition: background 0.2s ease;
}
.profile-trigger:hover {
  background: #f0f4f8;
}

.profile-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.profile-name {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
}
.profile-role {
  font-size: 12px;
  color: #7f8c8d;
}

/* Дополнительные стили для меню */
.profile-menu :deep(.p-menu-list) {
  min-width: 180px;
}
.profile-menu :deep(.p-menuitem-icon) {
  color: #1abc9c;
}
.profile-menu :deep(.p-menuitem-text) {
  font-size: 14px;
}
</style>