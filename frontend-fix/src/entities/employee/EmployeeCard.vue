<script setup lang="ts">
import Button from 'primevue/button'
import type { Employee } from '@/shared/types'
import HexAvatar from '@/shared/ui/HexAvatar.vue'

defineProps<{ employee: Employee; canManage: boolean }>()
const emit = defineEmits<{ (e: 'edit'): void; (e: 'remove'): void }>()
</script>

<template>
  <article class="emp-card surface-card">
    <div class="emp-card__top">
      <HexAvatar :name="employee.full_name" :color="employee.avatar_color" :size="48" />
      <div class="emp-card__id">
        <strong>{{ employee.full_name }}</strong>
        <div class="emp-card__status">
          <span class="dot" :class="employee.is_online ? 'dot--on' : 'dot--off'" />
          <span class="muted">{{ employee.is_online ? 'В сети' : 'Не в сети' }}</span>
          <span v-if="employee.departments[0]" class="emp-card__dep" :style="{ background: employee.departments[0].color || '#dcf1ec' }">
            {{ employee.departments[0].name }}
          </span>
        </div>
      </div>
    </div>

    <div class="emp-card__phone muted">
      <span>Телефон:</span> {{ employee.phone || '—' }}
    </div>

    <div v-if="canManage" class="emp-card__actions">
      <Button icon="pi pi-pencil" size="small" severity="secondary" text rounded aria-label="Редактировать" @click="emit('edit')" />
      <Button icon="pi pi-trash" size="small" severity="danger" text rounded aria-label="Удалить" @click="emit('remove')" />
    </div>
  </article>
</template>

<style scoped>
.emp-card { padding: 18px; display: flex; flex-direction: column; gap: 12px; position: relative; }
.emp-card__top { display: flex; gap: 12px; align-items: center; }
.emp-card__id { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.emp-card__id strong { font-size: 15px; }
.emp-card__status { display: flex; align-items: center; gap: 6px; font-size: 12px; flex-wrap: wrap; }
.emp-card__dep { color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.emp-card__phone { font-size: 13px; }
.emp-card__phone span { color: var(--c-text); font-weight: 600; }
.emp-card__actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 2px; }
</style>
