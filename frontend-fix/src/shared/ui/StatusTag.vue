<script setup lang="ts">
import { computed } from 'vue'
import type { TaskPriority, TaskStatus } from '@/shared/types'

const props = defineProps<{ status?: TaskStatus; priority?: TaskPriority }>()

const STATUS_MAP: Record<TaskStatus, { label: string; bg: string; color: string }> = {
  planned: { label: 'Запланирована', bg: '#dcf1ec', color: '#1a8c77' },
  in_progress: { label: 'В работе', bg: '#fff2d6', color: '#b9842b' },
  done: { label: 'Готово', bg: '#e3f6ee', color: '#1fa98f' },
  canceled: { label: 'Отменена', bg: '#f1f3f5', color: '#8a97a8' },
}

const PRIORITY_MAP: Record<TaskPriority, { label: string; bg: string; color: string }> = {
  low: { label: 'Низкий', bg: '#eef1f5', color: '#8a97a8' },
  medium: { label: 'Средний', bg: '#dcf1ec', color: '#1a8c77' },
  high: { label: 'Высокий', bg: '#fde7e7', color: '#e0564f' },
}

const view = computed(() => {
  if (props.status) return STATUS_MAP[props.status]
  if (props.priority) return PRIORITY_MAP[props.priority]
  return { label: '', bg: '#eef1f5', color: '#8a97a8' }
})
</script>

<template>
  <span class="pill" :style="{ background: view.bg, color: view.color }">{{ view.label }}</span>
</template>
