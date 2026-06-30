<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem } from '@/shared/types'
import { fileExt, fileKind } from '@/shared/lib/format'

const props = defineProps<{ file: FileItem }>()

const kind = computed(() => fileKind(props.file.name))
const label = computed(() => fileExt(props.file.name).toUpperCase() || 'FILE')
</script>

<template>
  <div class="file-tile">
    <div class="file-tile__thumb" :data-kind="kind">
      <i v-if="kind === 'video'" class="pi pi-play" />
      <span v-else class="file-tile__type">{{ label }}</span>
    </div>
    <span class="file-tile__name" :title="file.name">{{ file.name }}</span>
  </div>
</template>

<style scoped>
.file-tile { cursor: pointer; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.file-tile__thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  background: var(--c-primary-300);
  color: #fff;
  display: grid; place-items: center;
  position: relative;
  box-shadow: var(--shadow-soft);
  transition: transform 0.14s ease;
  clip-path: polygon(0 0, 78% 0, 100% 18%, 100% 100%, 0 100%);
}
.file-tile:hover .file-tile__thumb { transform: translateY(-3px); }
.file-tile__thumb[data-kind='video'] { background: var(--c-primary); clip-path: none; border-radius: 16px; }
.file-tile__thumb[data-kind='image'] { background: #6fd3bd; }
.file-tile__type { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
.file-tile__thumb .pi-play { font-size: 26px; }
.file-tile__name { font-size: 12px; color: var(--c-text-muted); text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
