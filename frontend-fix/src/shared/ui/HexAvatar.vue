<script setup lang="ts">
import { computed } from 'vue'
import { initials as toInitials } from '@/shared/lib/format'

const props = withDefaults(
  defineProps<{ name?: string; initials?: string; color?: string; size?: number }>(),
  { size: 44, color: '#5B8DEF' },
)

const text = computed(() => props.initials ?? (props.name ? toInitials(props.name) : '—'))
const fontSize = computed(() => Math.round(props.size * 0.34))
</script>

<template>
  <span
    class="hex"
    :style="{ '--hex-size': size + 'px', background: color, fontSize: fontSize + 'px' }"
  >{{ text }}</span>
</template>
