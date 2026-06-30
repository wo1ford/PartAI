<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title: string; subtitle?: string }>(), {
  icon: 'pi pi-inbox',
})
</script>

<template>
  <div class="empty-state">
    <i :class="icon" aria-hidden="true" />
    <strong>{{ title }}</strong>
    <span v-if="subtitle" class="muted">{{ subtitle }}</span>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 56px 20px;
  text-align: center;
}
.empty-state i { font-size: 30px; color: var(--c-primary-300); }
.empty-state strong { font-size: 15px; }
</style>
