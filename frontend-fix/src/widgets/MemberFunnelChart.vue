<script setup lang="ts">
import { computed } from 'vue'
import type { MemberSeriesPoint } from '@/shared/types'

const props = defineProps<{ series: MemberSeriesPoint[] }>()

const CHART_HEIGHT = 280

const segments = [
  { key: 'signed' as const, label: 'Подписали', color: '#2fbfa4' },
  { key: 'thinking' as const, label: 'Думают', color: '#7fd7c6' },
  { key: 'unprocessed' as const, label: 'Ещё не обработаны', color: '#dcf1ec' },
]

const maxTotal = computed(() => {
  const totals = props.series.map((p) => p.signed + p.thinking + p.unprocessed)
  return Math.max(1, ...totals)
})

/** "Красивый" верхний предел и шаг для линий сетки. */
const niceMax = computed(() => {
  const raw = maxTotal.value
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = Math.ceil(raw / pow) * pow
  return n
})

const gridLines = computed(() => {
  const steps = 5
  const lines: { value: number; y: number }[] = []
  for (let i = 0; i <= steps; i += 1) {
    const value = Math.round((niceMax.value / steps) * i)
    const y = CHART_HEIGHT - (value / niceMax.value) * CHART_HEIGHT
    lines.push({ value, y })
  }
  return lines.reverse()
})

function segHeight(value: number): number {
  return (value / niceMax.value) * CHART_HEIGHT
}
</script>

<template>
  <div class="funnel surface-card">
    <header class="funnel__head">
      <h3>Члены Партии</h3>
      <ul class="funnel__legend">
        <li v-for="s in segments" :key="s.key">
          <span class="legend-dot" :style="{ background: s.color }" />{{ s.label }}
        </li>
      </ul>
    </header>

    <div class="funnel__plot" :style="{ height: CHART_HEIGHT + 'px' }">
      <div class="funnel__grid">
        <div v-for="line in gridLines" :key="line.value" class="grid-line" :style="{ top: line.y + 'px' }">
          <span class="grid-line__label">{{ line.value }}</span>
        </div>
      </div>

      <div class="funnel__bars">
        <div v-for="point in series" :key="point.bucket" class="bar-col">
          <div class="bar-stack">
            <div
              v-for="s in segments"
              :key="s.key"
              class="bar-seg"
              :style="{ height: segHeight(point[s.key]) + 'px', background: s.color }"
              :title="`${s.label}: ${point[s.key]}`"
            />
          </div>
        </div>
      </div>
    </div>

    <footer class="funnel__axis">
      <span v-for="point in series" :key="point.bucket">{{ point.bucket }}</span>
    </footer>
  </div>
</template>

<style scoped>
.funnel { padding: 26px 28px 20px; }
.funnel__head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 26px; }
.funnel__head h3 { font-size: 19px; }
.funnel__legend { list-style: none; margin: 0; padding: 0; display: flex; gap: 22px; flex-wrap: wrap; }
.funnel__legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--c-text-muted); font-weight: 500; }
.legend-dot { width: 11px; height: 11px; border-radius: 50%; }

.funnel__plot { position: relative; padding-left: 34px; }
.funnel__grid { position: absolute; inset: 0 0 0 34px; }
.grid-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--c-border); }
.grid-line__label { position: absolute; left: -34px; top: -8px; font-size: 12px; color: var(--c-text-soft); width: 28px; text-align: right; }

.funnel__bars { position: relative; height: 100%; display: flex; align-items: flex-end; gap: 14px; }
.bar-col { flex: 1; display: flex; justify-content: center; height: 100%; align-items: flex-end; }
.bar-stack {
  width: 60%;
  max-width: 46px;
  display: flex;
  flex-direction: column-reverse;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
}
.bar-seg { width: 100%; transition: height 0.4s ease; }

.funnel__axis { display: flex; gap: 14px; padding-left: 34px; margin-top: 12px; }
.funnel__axis span { flex: 1; text-align: center; font-size: 12px; color: var(--c-text-muted); font-weight: 600; }
</style>
