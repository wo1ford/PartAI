<script setup lang="ts">
defineProps<{ name: string; active?: boolean; compact?: boolean }>()
</script>

<template>
  <button type="button" class="folder" :class="{ 'is-active': active, 'is-compact': compact }">
    <span class="folder__tab" />
    <span class="folder__name">{{ name }}</span>
  </button>
</template>

<style scoped>
.folder {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 0;
  background: var(--c-primary);
  border-radius: 16px;
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  padding: 16px;
  box-shadow: var(--shadow-soft);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}
.folder:hover { transform: translateY(-3px); box-shadow: var(--shadow-card); }
.folder.is-active { outline: 3px solid var(--c-primary-100); }
.folder.is-compact { aspect-ratio: auto; height: 64px; padding: 10px 12px; border-radius: 12px; align-items: center; }
.folder__tab {
  position: absolute;
  top: -9px; left: 18px;
  width: 52px; height: 16px;
  background: var(--c-primary);
  border-radius: 8px 8px 0 0;
}
.folder.is-compact .folder__tab { display: none; }
.folder__name { color: #fff; font-weight: 700; font-size: 15px; text-align: left; line-height: 1.2; }
.folder.is-compact .folder__name { font-size: 13px; }
</style>
