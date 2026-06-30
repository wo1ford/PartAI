<script setup lang="ts">
import type { Department } from '@/shared/types'
import HexAvatar from '@/shared/ui/HexAvatar.vue'

defineProps<{
  department: Department
}>()
</script>

<template>
  <div class="dept-card" @click="$emit('click')">
    <!-- Слот для кнопки редактирования (Карандаш) -->
    <div class="dept-card__actions">
      <slot name="actions" />
    </div>

    <div class="dept-card__head">
      <div class="dept-color-badge" :style="{ background: department.color || '#1abc9c' }" />
      <h3 class="dept-card__title">{{ department.name }}</h3>
    </div>

    <div class="dept-card__stats">
      <div class="stat">
        <i class="pi pi-flag" />
        <span>{{ department.stats?.tasks_total || 0 }} задач</span>
      </div>
      <div class="stat">
        <i class="pi pi-check-circle" />
        <span>{{ department.stats?.tasks_done || 0 }} выполнено</span>
      </div>
      <div class="stat">
        <i class="pi pi-users" />
        <span>{{ department.stats?.employees_count || 0 }} сотруд.</span>
      </div>
    </div>

    <div class="dept-card__employees">
      <!-- Здесь аватарки не слипаются, потому что flex-wrap: wrap -->
      <HexAvatar
        v-for="emp in department.employees?.slice(0, 5) || []"
        :key="emp.id"
        :name="emp.full_name"
        :color="emp.avatar_color"
        :size="32"
      />
      <span v-if="(department.employees?.length || 0) > 5" class="dept-more-emp">
        +{{ (department.employees?.length || 0) - 5 }}
      </span>
      <span v-if="!department.employees?.length" class="muted dept-no-emp">Нет сотрудников</span>
    </div>
  </div>
</template>

<style scoped>
.dept-card {
  position: relative; /* Важно для позиционирования карандаша */
  background: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dept-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  border-color: #1abc9c;
}

/* Слот для карандаша */
.dept-card__actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

.dept-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dept-color-badge {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dept-card__title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.dept-card__stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #7f8c8d;
}
.stat i {
  color: #1abc9c;
  font-size: 14px;
}

.dept-card__employees {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap; /* Исправляет слипание аватарок */
  margin-top: 4px;
}
.dept-more-emp {
  font-size: 12px;
  font-weight: 600;
  color: #7f8c8d;
  background: #f0f4f8;
  padding: 4px 8px;
  border-radius: 20px;
}
.dept-no-emp {
  font-size: 13px;
}
</style>