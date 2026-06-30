<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__title">
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="muted">{{ subtitle }}</p>
    </div>
    <div class="page-header__search"><slot name="search" /></div>
    <div class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}
.page-header__title h1 { font-size: 26px; }
.page-header__title p { font-size: 13px; margin-top: 2px; }
.page-header__search { flex: 1; min-width: 0; }
.page-header__actions { display: flex; align-items: center; gap: 10px; flex: none; }
</style>
