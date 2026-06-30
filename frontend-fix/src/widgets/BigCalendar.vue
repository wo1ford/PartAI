<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Task } from '@/shared/types'
import { ddmm, hhmm, isSameDay, ruWeekdayShort } from '@/shared/lib/format'
import HexAvatar from '@/shared/ui/HexAvatar.vue'

const props = defineProps<{ tasks: Task[]; days: Date[] }>()
const emit = defineEmits<{
  (e: 'select', task: Task): void
  (e: 'create', payload: { starts_at: string; ends_at: string }): void
  (e: 'move', payload: { id: string; starts_at: string; ends_at: string }): void
}>()

const HOUR_HEIGHT = 52
const SNAP = 15
const DAY_MIN = 24 * 60

const hours = Array.from({ length: 24 }, (_, i) => i)
const now = ref(new Date())
let nowTimer: number | undefined

const bodyRef = ref<HTMLElement>()
const gridRef = ref<HTMLElement>()

function minToY(min: number): number {
  return (min / 60) * HOUR_HEIGHT
}
function snap(min: number): number {
  return Math.max(0, Math.min(DAY_MIN, Math.round(min / SNAP) * SNAP))
}
function taskStartMin(t: Task): number {
  const d = new Date(t.starts_at)
  return d.getHours() * 60 + d.getMinutes()
}
function taskEndMin(t: Task): number {
  const d = t.ends_at ? new Date(t.ends_at) : new Date(new Date(t.starts_at).getTime() + 3600000)
  return d.getHours() * 60 + d.getMinutes()
}

interface Positioned {
  task: Task
  top: number
  height: number
  width: number
  left: number
}

function layoutDay(day: Date): Positioned[] {
  const dayTasks = props.tasks
    .filter((t) => isSameDay(new Date(t.starts_at), day))
    .sort((a, b) => taskStartMin(a) - taskStartMin(b))

  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()
  for (const t of dayTasks) {
    const s = taskStartMin(t)
    const e = Math.max(taskEndMin(t), s + 15)
    let lane = laneEnds.findIndex((end) => end <= s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(e)
    } else {
      laneEnds[lane] = e
    }
    laneOf.set(t.id, lane)
  }
  const laneCount = Math.max(1, laneEnds.length)
  return dayTasks.map((t) => {
    const s = taskStartMin(t)
    const e = Math.max(taskEndMin(t), s + 15)
    const lane = laneOf.get(t.id) ?? 0
    return { task: t, top: minToY(s), height: Math.max(22, minToY(e - s)), width: 100 / laneCount, left: (100 / laneCount) * lane }
  })
}

function nowMin(): number {
  return now.value.getHours() * 60 + now.value.getMinutes()
}

// ---------------- drag interactions ----------------
interface Draft {
  mode: 'create' | 'move' | 'resize'
  dayIndex: number
  startMin: number
  endMin: number
  task?: Task
  grabOffset: number
  duration: number
  colRects: DOMRect[]
  moved: boolean
}
const draft = ref<Draft | null>(null)

function colRects(): DOMRect[] {
  const grid = gridRef.value
  if (!grid) return []
  return Array.from(grid.querySelectorAll<HTMLElement>('.bc-col')).map((el) => el.getBoundingClientRect())
}

function yToMin(clientY: number): number {
  const grid = gridRef.value
  if (!grid) return 0
  const top = grid.getBoundingClientRect().top
  return Math.max(0, Math.min(DAY_MIN, ((clientY - top) / HOUR_HEIGHT) * 60))
}

function xToDayIndex(clientX: number, rects: DOMRect[]): number {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i]
    if (r && clientX >= r.left && clientX <= r.right) return i
  }
  return Math.max(0, Math.min(rects.length - 1, 0))
}

function startCreate(dayIndex: number, event: PointerEvent): void {
  const min = snap(yToMin(event.clientY))
  draft.value = { mode: 'create', dayIndex, startMin: min, endMin: min + SNAP, grabOffset: 0, duration: 0, colRects: colRects(), moved: false }
  attach()
}

function startMove(task: Task, dayIndex: number, event: PointerEvent): void {
  event.stopPropagation()
  const s = taskStartMin(task)
  const e = Math.max(taskEndMin(task), s + 15)
  draft.value = { mode: 'move', dayIndex, startMin: s, endMin: e, task, grabOffset: yToMin(event.clientY) - s, duration: e - s, colRects: colRects(), moved: false }
  attach()
}

function startResize(task: Task, dayIndex: number, event: PointerEvent): void {
  event.stopPropagation()
  const s = taskStartMin(task)
  const e = Math.max(taskEndMin(task), s + 15)
  draft.value = { mode: 'resize', dayIndex, startMin: s, endMin: e, task, grabOffset: 0, duration: e - s, colRects: colRects(), moved: false }
  attach()
}

function onPointerMove(event: PointerEvent): void {
  const d = draft.value
  if (!d) return
  d.moved = true
  const min = yToMin(event.clientY)
  if (d.mode === 'create') {
    d.endMin = snap(min)
  } else if (d.mode === 'resize') {
    d.endMin = Math.max(d.startMin + SNAP, snap(min))
  } else {
    const newStart = snap(min - d.grabOffset)
    d.startMin = Math.max(0, Math.min(DAY_MIN - d.duration, newStart))
    d.endMin = d.startMin + d.duration
    d.dayIndex = xToDayIndex(event.clientX, d.colRects)
  }
}

function onPointerUp(): void {
  const d = draft.value
  detach()
  draft.value = null
  if (!d) return
  const day = props.days[d.dayIndex]
  if (!day) return

  if (d.mode === 'create') {
    let s = Math.min(d.startMin, d.endMin)
    let e = Math.max(d.startMin, d.endMin)
    if (e - s < SNAP) e = s + 60 // простой клик → 1 час
    s = snap(s); e = snap(e)
    emit('create', { starts_at: composeISO(day, s), ends_at: composeISO(day, e) })
  } else if (d.task) {
    if (!d.moved) {
      emit('select', d.task)
    } else {
      emit('move', { id: d.task.id, starts_at: composeISO(day, d.startMin), ends_at: composeISO(day, d.endMin) })
    }
  }
}

function composeISO(day: Date, min: number): string {
  const date = new Date(day)
  date.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return date.toISOString()
}

function attach(): void {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function detach(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function minLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const draftPreview = computed(() => {
  const d = draft.value
  if (!d) return null
  const s = Math.min(d.startMin, d.endMin)
  const e = Math.max(d.startMin, d.endMin)
  return {
    dayIndex: d.dayIndex,
    top: minToY(s),
    height: Math.max(16, minToY(e - s)),
    startLabel: minLabel(s),
    endLabel: minLabel(e),
  }
})

function cardClass(task: Task): string {
  if (task.priority === 'high') return 'is-high'
  if (task.status === 'done') return 'is-done'
  return 'is-default'
}

onMounted(() => {
  nowTimer = window.setInterval(() => { now.value = new Date() }, 60000)
  // автоскролл к текущему времени (как в Google Calendar)
  const target = Math.max(0, minToY(nowMin()) - 160)
  bodyRef.value?.scrollTo({ top: target })
})
onBeforeUnmount(() => {
  if (nowTimer) clearInterval(nowTimer)
  detach()
})
</script>

<template>
  <div class="bc surface-card" :style="{ '--cols': days.length }">
    <div class="bc-head">
      <div class="bc-gutter-head" />
      <div
        v-for="day in days"
        :key="day.toISOString()"
        class="bc-day-head"
        :class="{ 'is-today': isSameDay(day, now), 'is-weekend': day.getDay() === 0 || day.getDay() === 6 }"
      >
        <span class="bc-day-name">{{ ruWeekdayShort(day) }}</span>
        <span class="bc-day-date">{{ ddmm(day) }}</span>
      </div>
    </div>

    <div ref="bodyRef" class="bc-body scroll">
      <div class="bc-gutter">
        <div v-for="h in hours" :key="h" class="bc-hour-label" :style="{ height: HOUR_HEIGHT + 'px' }">
          <span v-if="h > 0">{{ String(h).padStart(2, '0') }}:00</span>
        </div>
      </div>

      <div ref="gridRef" class="bc-grid">
        <div
          v-for="(day, di) in days"
          :key="day.toISOString()"
          class="bc-col"
          :class="{ 'is-weekend': day.getDay() === 0 || day.getDay() === 6 }"
          @pointerdown.self="startCreate(di, $event)"
        >
          <div
            v-for="h in hours"
            :key="h"
            class="bc-hour-cell"
            :style="{ height: HOUR_HEIGHT + 'px' }"
            @pointerdown="startCreate(di, $event)"
          />

          <div v-if="isSameDay(day, now)" class="bc-now" :style="{ top: minToY(nowMin()) + 'px' }" />

          <!-- provisional drag preview -->
          <div
            v-if="draftPreview && draftPreview.dayIndex === di"
            class="bc-preview"
            :style="{ top: draftPreview.top + 'px', height: draftPreview.height + 'px' }"
          >
            {{ draftPreview.startLabel }} – {{ draftPreview.endLabel }}
          </div>

          <button
            v-for="pos in layoutDay(day)"
            :key="pos.task.id"
            type="button"
            class="bc-event"
            :class="cardClass(pos.task)"
            :style="{ top: pos.top + 'px', height: pos.height + 'px', width: `calc(${pos.width}% - 4px)`, left: `calc(${pos.left}% + 2px)` }"
            @pointerdown="startMove(pos.task, di, $event)"
          >
            <div class="bc-event__time">
              {{ hhmm(new Date(pos.task.starts_at)) }}<template v-if="pos.task.ends_at"> – {{ hhmm(new Date(pos.task.ends_at)) }}</template>
            </div>
            <div class="bc-event__title">{{ pos.task.title }}</div>
            <div v-if="pos.height > 54" class="bc-event__foot">
              <HexAvatar
                v-for="a in pos.task.assignees.slice(0, 3)"
                :key="a.id"
                :initials="a.initials"
                :color="a.avatar_color"
                :size="18"
              />
              <span v-if="pos.task.attachments_count" class="bc-event__attach"><i class="pi pi-paperclip" />{{ pos.task.attachments_count }}</span>
            </div>
            <span class="bc-event__resize" @pointerdown="startResize(pos.task, di, $event)" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bc { overflow: hidden; display: flex; flex-direction: column; }
.bc-head { display: grid; grid-template-columns: 60px repeat(var(--cols), 1fr); border-bottom: 1px solid var(--c-border); }
.bc-gutter-head { }
.bc-day-head { padding: 10px 8px; text-align: center; border-left: 1px solid var(--c-border); display: flex; flex-direction: column; gap: 2px; }
.bc-day-head.is-today { background: var(--c-primary-050); }
.bc-day-name { font-size: 12px; color: var(--c-text-muted); font-weight: 700; }
.bc-day-head.is-today .bc-day-name { color: var(--c-primary); }
.bc-day-date { font-size: 15px; font-weight: 700; }
.bc-day-head.is-weekend .bc-day-date { color: var(--c-danger); }

.bc-body { display: grid; grid-template-columns: 60px 1fr; max-height: 640px; overflow-y: auto; position: relative; }
.bc-gutter { display: flex; flex-direction: column; }
.bc-hour-label { font-size: 11px; color: var(--c-text-soft); text-align: right; padding-right: 8px; position: relative; }
.bc-hour-label span { position: absolute; right: 8px; top: -7px; }

.bc-grid { display: grid; grid-template-columns: repeat(var(--cols), 1fr); position: relative; }
.bc-col { position: relative; border-left: 1px solid var(--c-border); }
.bc-col.is-weekend { background: #fbfcfd; }
.bc-hour-cell { border-bottom: 1px solid var(--c-surface-2); }
.bc-hour-cell:hover { background: var(--c-primary-050); }

.bc-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--c-danger); z-index: 6; pointer-events: none; }
.bc-now::before { content: ''; position: absolute; left: -4px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--c-danger); }

.bc-preview { position: absolute; left: 2px; right: 2px; background: rgba(47,191,164,0.18); border: 1px dashed var(--c-primary); border-radius: 8px; z-index: 7; font-size: 11px; color: var(--c-primary-700); padding: 3px 6px; pointer-events: none; }

.bc-event {
  position: absolute; border: 0; border-left: 3px solid var(--c-primary);
  background: var(--c-primary-050); border-radius: 8px; padding: 4px 7px;
  text-align: left; cursor: grab; overflow: hidden; box-shadow: var(--shadow-soft);
  display: flex; flex-direction: column; gap: 1px; touch-action: none; user-select: none;
}
.bc-event:active { cursor: grabbing; }
.bc-event:hover { box-shadow: var(--shadow-card); z-index: 5; }
.bc-event.is-high { border-left-color: var(--c-danger); background: var(--c-pink-soft); }
.bc-event.is-done { border-left-color: var(--c-text-soft); background: #f6f8fa; opacity: 0.85; }
.bc-event__time { font-size: 10px; color: var(--c-text-muted); font-weight: 600; }
.bc-event__title { font-size: 12px; font-weight: 700; line-height: 1.15; }
.bc-event__foot { margin-top: auto; display: flex; align-items: center; gap: 2px; }
.bc-event__attach { font-size: 10px; color: var(--c-text-muted); display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; }
.bc-event__resize { position: absolute; left: 0; right: 0; bottom: 0; height: 7px; cursor: ns-resize; }
</style>
