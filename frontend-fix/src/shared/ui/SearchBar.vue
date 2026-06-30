<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: 'Поиск' })
const model = defineModel<string>({ default: '' })
</script>

<template>
  <IconField class="search-bar">
    <InputIcon class="pi pi-search" />
    <InputText v-model="model" :placeholder="placeholder" :aria-label="placeholder" fluid />
  </IconField>
</template>

<style scoped>
.search-bar { display: block; width: 100%; }
.search-bar :deep(.p-inputtext) {
  width: 100%;
  background: var(--c-primary-050);
  border-color: transparent;
  border-radius: 999px;
  padding-left: 40px;
  height: 44px;
}
.search-bar :deep(.p-inputicon) { color: var(--c-primary); }
</style>
