<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const confirm = useConfirm()
const auth = useAuthStore()

const items = [
  { to: '/dashboard', icon: 'pi pi-home', label: 'Главная' },
  { to: '/calendar', icon: 'pi pi-calendar', label: 'Календарь' },
  { to: '/materials', icon: 'pi pi-inbox', label: 'Материалы' },
  { to: '/departments', icon: 'pi pi-th-large', label: 'Отделения' },
  { to: '/employees', icon: 'pi pi-user', label: 'Сотрудники' },
  { to: '/chat', icon: 'pi pi-comment', label: 'Чат' },
]

function logout(event: Event): void {
  confirm.require({
    target: event.currentTarget as HTMLElement,
    message: 'Выйти из системы?',
    icon: 'pi pi-sign-out',
    acceptLabel: 'Выйти',
    rejectLabel: 'Отмена',
    accept: async () => {
      await auth.logout()
      router.push('/login')
    },
  })
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__logo" aria-label="Новые люди">
      <span class="logo-box"><span class="logo-inner" /></span>
    </div>

    <nav class="sidebar__nav" aria-label="Основная навигация">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :title="item.label"
        active-class="is-active"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span class="nav-item__tip">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar__bottom">
      <RouterLink to="/settings" class="nav-item" title="Настройки" active-class="is-active">
        <i class="pi pi-cog" aria-hidden="true" />
        <span class="nav-item__tip">Настройки</span>
      </RouterLink>
      <div class="sidebar__divider" />
      <button class="nav-item nav-item--logout" type="button" title="Выход" @click="logout">
        <i class="pi pi-sign-out" aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--side-w);
  background: var(--c-bg);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 22px 0 24px;
  z-index: 30;
}
.sidebar__logo { margin-bottom: 28px; }
.logo-box {
  width: 46px; height: 46px;
  background: var(--c-primary);
  border-radius: 14px;
  display: grid; place-items: center;
  box-shadow: 0 8px 18px rgba(47, 191, 164, 0.35);
}
.logo-inner { width: 20px; height: 20px; background: #fff; border-radius: 7px; }

.sidebar__nav { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.sidebar__bottom { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.sidebar__divider { width: 34px; height: 1px; background: var(--c-border); }

.nav-item {
  position: relative;
  width: 46px; height: 46px;
  border: 0; background: transparent; cursor: pointer;
  border-radius: 13px;
  display: grid; place-items: center;
  color: var(--c-text-muted);
  transition: all 0.15s ease;
}
.nav-item i { font-size: 19px; }
.nav-item:hover { background: var(--c-primary-050); color: var(--c-primary); }
.nav-item.is-active {
  background: var(--c-primary);
  color: #fff;
  box-shadow: 0 8px 18px rgba(47, 191, 164, 0.32);
}
.nav-item--logout { color: var(--c-danger); }
.nav-item--logout:hover { background: #fde7e7; color: var(--c-danger); }

.nav-item__tip {
  position: absolute;
  left: 56px;
  white-space: nowrap;
  background: var(--c-text);
  color: #fff;
  font-size: 12px;
  padding: 5px 9px;
  border-radius: 7px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition: all 0.15s ease;
  z-index: 5;
}
.nav-item:hover .nav-item__tip { opacity: 1; transform: translateX(0); }
</style>
