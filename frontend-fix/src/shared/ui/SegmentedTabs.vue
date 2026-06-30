<script setup lang="ts" generic="T extends string">
defineProps<{ options: { label: string; value: T }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="segmented">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="segmented__item"
      :class="{ 'is-active': model === opt.value }"
      @click="model = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 999px;
}
.segmented__item {
  border: 0;
  background: transparent;
  color: var(--c-text-muted);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.segmented__item.is-active {
  background: var(--c-primary);
  color: #fff;
  box-shadow: 0 6px 14px rgba(47, 191, 164, 0.3);
}
.segmented__item:not(.is-active):hover { color: var(--c-text); }
</style>
