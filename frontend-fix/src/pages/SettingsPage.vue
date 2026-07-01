<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import PageHeader from '@/shared/ui/PageHeader.vue'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useOfficeStore } from '@/stores/office.store'

const auth = useAuthStore()
const office = useOfficeStore()
const toast = useToast()

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  office_manager: 'Руководитель офиса',
  employee: 'Сотрудник',
}

// Данные профиля (связываем напрямую с auth.user)
const fullName = ref(auth.user?.full_name ?? '')
const email = ref(auth.user?.email ?? '')
const phone = ref('+7 (999) 123-45-67')
const role = ref(auth.user?.role ?? 'employee')

// Уведомления
const notifyTasks = ref(true)
const notifyFiles = ref(false)
const notifyComments = ref(true)

// ===== ЦВЕТ АВАТАРКИ =====
const localAvatarColor = ref(auth.user?.avatar_color || '#1abc9c')

const colorPalette = [
  '#ef476f', '#e91e63', '#c2185b', '#aa00ff', '#651fff',
  '#2979ff', '#039be5', '#00bcd4', '#00bfa5', '#1abc9c',
  '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
  '#ff9800', '#ff5722', '#795548', '#607d8b', '#000000',
]

const activeTab = ref<'profile' | 'appearance' | 'office' | 'notifications'>('profile')

// ===== ПАРОЛЬ С КРАСИВЫМИ ФЛАЖКАМИ =====
const newPassword = ref('')

// Правила и их проверка в реальном времени
const checks = computed(() => {
  const val = newPassword.value
  return {
    length: val.length >= 8,
    cases: /[a-z]/.test(val) && /[A-Z]/.test(val),
    digits: /\d/.test(val) || /[!@#$%^&*(),.?":{}|<>]/.test(val),
  }
})

// ===== СОХРАНЕНИЕ ИМЕНИ И ЦВЕТА (Обновляет верхний правый угол) =====
async function saveProfile(): Promise<void> {
  try {
    if (auth.user) {
      // 1. Обновляем локальные данные в сторе (Pinia), чтобы хедер перерисовался
      auth.user.full_name = fullName.value
      auth.user.avatar_color = localAvatarColor.value
      
      // 2. Здесь должен быть реальный API-вызов для сохранения на сервер
      // await UserApi.updateProfile({ full_name: fullName.value, avatar_color: localAvatarColor.value })

      toast.add({ 
        severity: 'success', 
        summary: 'Сохранено', 
        detail: 'Имя и данные профиля обновлены', 
        life: 2000 
      })
    }
  } catch (error) {
    toast.add({ 
      severity: 'error', 
      summary: 'Ошибка', 
      detail: 'Не удалось сохранить изменения', 
      life: 3000 
    })
  }
}

// Сохранить только цвет (вызывается из вкладки Оформление)
async function saveAppearance(): Promise<void> {
  await saveProfile()
}

function formatPhone(phone: string): string {
  // Простое форматирование для визуала
  return phone
}
</script>

<template>
  <div class="settings-page">
    <PageHeader title="Настройки" subtitle="Профиль и параметры системы" />

    <div class="settings-layout">
      <aside class="settings-nav surface-card">
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'profile' }"
          @click="activeTab = 'profile'"
        >
          <i class="pi pi-user" />
          <span>Профиль</span>
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'appearance' }"
          @click="activeTab = 'appearance'"
        >
          <i class="pi pi-palette" />
          <span>Оформление</span>
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'office' }"
          @click="activeTab = 'office'"
        >
          <i class="pi pi-building" />
          <span>Офис</span>
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'notifications' }"
          @click="activeTab = 'notifications'"
        >
          <i class="pi pi-bell" />
          <span>Уведомления</span>
        </div>
      </aside>

      <div class="settings-content surface-card">
        <!-- ПРОФИЛЬ -->
        <div v-if="activeTab === 'profile'" class="tab-content">
          <div class="profile-header">
            <div class="avatar-wrapper">
              <HexAvatar 
                v-if="auth.user" 
                :name="auth.user.full_name" 
                :color="auth.user.avatar_color" 
                :size="72" 
              />
            </div>
            <div class="profile-info">
              <h2>{{ auth.user?.full_name }}</h2>
              <span class="role-badge">{{ auth.user ? ROLE_LABEL[auth.user.role] : '' }}</span>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Полное имя</label>
              <InputText v-model="fullName" placeholder="Иванов Иван Иванович" fluid />
            </div>
            <div class="field">
              <label>Электронная почта</label>
              <InputText :model-value="email" disabled fluid />
            </div>
            <div class="field">
              <label>Телефон</label>
              <InputText v-model="phone" placeholder="+7 (999) 123-45-67" fluid />
            </div>
            <div class="field">
              <label>Роль</label>
              <Select 
                v-model="role" 
                :options="Object.keys(ROLE_LABEL)" 
                :option-label="(k) => ROLE_LABEL[k]" 
                disabled 
                fluid 
              />
            </div>
            
            <!-- ПАРОЛЬ С КАСТОМНЫМИ ФЛАЖКАМИ -->
            <div class="field">
              <label>Изменить пароль</label>
              <Password 
                v-model="newPassword"
                placeholder="Новый пароль" 
                toggle-mask 
                fluid 
                :feedback="false"
              />
              
              <!-- Красивые флажки -->
              <div class="password-checks">
                <div class="check-item" :class="{ 'check-item--done': checks.length }">
                  <i class="pi" :class="checks.length ? 'pi-check-circle' : 'pi-circle'" />
                  <span>Не менее 8 символов</span>
                </div>
                <div class="check-item" :class="{ 'check-item--done': checks.cases }">
                  <i class="pi" :class="checks.cases ? 'pi-check-circle' : 'pi-circle'" />
                  <span>Строчные и заглавные буквы</span>
                </div>
                <div class="check-item" :class="{ 'check-item--done': checks.digits }">
                  <i class="pi" :class="checks.digits ? 'pi-check-circle' : 'pi-circle'" />
                  <span>Цифры или спецсимволы</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <Button label="Сохранить изменения" icon="pi pi-check" @click="saveProfile" />
          </div>
        </div>

        <!-- ОФОРМЛЕНИЕ -->
        <div v-if="activeTab === 'appearance'" class="tab-content appearance-tab">
          <div class="appearance-controls">
            <div class="control-section">
              <h3 class="tab-title">Цвет аватарки</h3>
              <div class="color-palette">
                <div 
                  v-for="color in colorPalette" 
                  :key="color"
                  class="color-circle"
                  :style="{ backgroundColor: color }"
                  :class="{ 'color-circle--active': localAvatarColor === color }"
                  @click="localAvatarColor = color"
                />
              </div>
            </div>

            <div class="form-actions appearance-actions">
              <Button label="Сохранить изменения" icon="pi pi-check" @click="saveAppearance" />
            </div>
          </div>

          <div class="appearance-preview">
            <div class="preview-full-container">
              <HexAvatar 
                :name="auth.user?.full_name || 'Пользователь'" 
                :color="localAvatarColor"
                :size="96"
              />
              <div class="preview-info">
                <span class="preview-name">{{ auth.user?.full_name || 'Пользователь' }}</span>
                <span class="preview-role">{{ auth.user ? ROLE_LABEL[auth.user.role] : 'Сотрудник' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ОФИС -->
        <div v-if="activeTab === 'office'" class="tab-content">
          <h3 class="tab-title">Информация об офисе</h3>
          <div class="office-card">
            <div class="office-icon"><i class="pi pi-building" /></div>
            <div class="office-details">
              <h4>{{ office.activeOffice?.name ?? 'Офис не выбран' }}</h4>
              <p>{{ office.activeOffice?.city ?? '—' }}</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Название офиса</label>
              <InputText :model-value="office.activeOffice?.name ?? '—'" disabled fluid />
            </div>
            <div class="field">
              <label>Город</label>
              <InputText :model-value="office.activeOffice?.city ?? '—'" disabled fluid />
            </div>
          </div>
        </div>

        <!-- УВЕДОМЛЕНИЯ -->
        <div v-if="activeTab === 'notifications'" class="tab-content">
          <h3 class="tab-title">Управление уведомлениями</h3>
          <div class="toggle-group">
            <div class="toggle-row">
              <div>
                <strong>Новые задачи</strong>
                <p class="muted">Оповещать о назначенных задачах</p>
              </div>
              <ToggleSwitch v-model="notifyTasks" />
            </div>
            <div class="toggle-row">
              <div>
                <strong>Загрузка файлов</strong>
                <p class="muted">Оповещать о новых материалах</p>
              </div>
              <ToggleSwitch v-model="notifyFiles" />
            </div>
            <div class="toggle-row">
              <div>
                <strong>Комментарии</strong>
                <p class="muted">Оповещать о новых комментариях к задачам</p>
              </div>
              <ToggleSwitch v-model="notifyComments" />
            </div>
          </div>
          <div class="form-actions">
            <Button label="Сохранить настройки" icon="pi pi-check" @click="saveProfile" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page { max-width: 1200px; margin: 0 auto; }
.settings-layout { display: grid; grid-template-columns: 200px 1fr; gap: 24px; margin-top: 8px; }
.settings-nav { padding: 16px 8px; border-radius: 16px; display: flex; flex-direction: column; gap: 4px; height: fit-content; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; color: #7f8c8d; font-weight: 500; }
.nav-item:hover { background: #f8f9fa; color: #2c3e50; }
.nav-item.active { background: #e0f7fa; color: #1abc9c; }
.nav-item i { font-size: 18px; }
.settings-content { padding: 32px; border-radius: 16px; min-height: 500px; }
.tab-content { display: flex; flex-direction: column; gap: 24px; }
.tab-title { font-size: 18px; font-weight: 600; color: #2c3e50; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid #eef2f6; }

/* ===== ПРОФИЛЬ ===== */
.profile-header { display: flex; align-items: center; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid #f0f4f8; }
.avatar-wrapper { position: relative; cursor: pointer; }
.profile-info h2 { font-size: 22px; margin: 0; }
.role-badge { background: #e0f7fa; color: #1abc9c; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }

/* ===== ФОРМЫ ===== */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 600; color: #7f8c8d; }
.form-actions { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #f0f4f8; }
.appearance-actions { margin-top: 8px; border-top: none; padding-top: 0; }

/* ===== КРАСИВЫЕ ЧЕК-ФЛАЖКИ ДЛЯ ПАРОЛЯ ===== */
.password-checks {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #95a5a6;
  transition: all 0.3s ease;
}
.check-item i {
  font-size: 16px;
  color: #bdc3c7;
  transition: all 0.3s ease;
}
.check-item--done {
  color: #2c3e50;
}
.check-item--done i {
  color: #1abc9c;
}

/* ===== ОФОРМЛЕНИЕ ===== */
.appearance-tab { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.appearance-controls { display: flex; flex-direction: column; }
.control-section:not(:last-child) { margin-bottom: 32px; }

/* ===== ЦВЕТ ===== */
.color-palette { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; max-width: 320px; }
.color-circle { width: 100%; aspect-ratio: 1 / 1; border-radius: 50%; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
.color-circle:hover { transform: scale(1.05); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); }
.color-circle--active { box-shadow: 0 0 0 4px #ffffff, 0 0 0 6px #1a1a1a, 0 4px 12px rgba(0, 0, 0, 0.2); transform: scale(1.05); }

/* ===== ПРЕВЬЮ ===== */
.appearance-preview { display: flex; flex-direction: column; justify-content: center; height: 100%; }
.preview-full-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; min-height: 220px; }
.preview-info { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.preview-name { font-size: 18px; font-weight: 600; color: #2c3e50; }
.preview-role { font-size: 14px; color: #7f8c8d; }

/* ===== ОФИС ===== */
.office-card { display: flex; align-items: center; gap: 20px; padding: 20px 24px; background: #f8f9fa; border-radius: 12px; border: 1px solid #eef2f6; }
.office-icon { width: 48px; height: 48px; background: #e0f7fa; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1abc9c; font-size: 22px; }
.office-details h4 { font-size: 16px; margin: 0; }
.office-details p { margin: 2px 0 0; color: #7f8c8d; font-size: 14px; }

/* ===== УВЕДОМЛЕНИЯ ===== */
.toggle-group { display: flex; flex-direction: column; gap: 4px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f4f8; }
.toggle-row:last-child { border-bottom: none; }
.toggle-row p { font-size: 13px; margin: 2px 0 0; }

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 900px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-nav { flex-direction: row; overflow-x: auto; padding: 8px; }
  .nav-item { white-space: nowrap; padding: 8px 16px; }
  .appearance-tab { grid-template-columns: 1fr; gap: 24px; }
  .color-palette { grid-template-columns: repeat(5, 1fr); max-width: 100%; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>