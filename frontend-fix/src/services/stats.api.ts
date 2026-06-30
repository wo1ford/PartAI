import type { Granularity, MemberSeriesPoint, MemberStats, StatsSummary, UUID } from '@/shared/types'
import { tasks } from '@/mocks/data'
import { addDays, ddmmyyyy } from '@/shared/lib/format'
import { clone, delay } from '@/mocks/util'

function seeded(n: number): number {
  const x = Math.sin(n * 9973.13) * 10000
  return x - Math.floor(x)
}

function dayLabel(d: Date): string {
  const RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  return `${d.getDate()} ${RU[d.getMonth()]}`
}

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function buildSeries(granularity: Granularity, officeSeed: number): MemberSeriesPoint[] {
  const points: MemberSeriesPoint[] = []
  if (granularity === 'day') {
    const start = addDays(new Date(), -11)
    for (let i = 0; i < 12; i += 1) {
      const d = addDays(start, i)
      const base = seeded(officeSeed + i + 1)
      const signed = Math.round(1 + base * 22)
      const thinking = Math.round(1 + seeded(officeSeed + i + 50) * 6)
      const unprocessed = Math.round(seeded(officeSeed + i + 99) * 4)
      points.push({ bucket: dayLabel(d), signed, thinking, unprocessed })
    }
  } else if (granularity === 'month') {
    for (let i = 0; i < 12; i += 1) {
      const base = seeded(officeSeed + i + 200)
      points.push({
        bucket: MONTHS_SHORT[i] ?? `M${i + 1}`,
        signed: Math.round(40 + base * 160),
        thinking: Math.round(20 + seeded(officeSeed + i + 250) * 60),
        unprocessed: Math.round(seeded(officeSeed + i + 300) * 40),
      })
    }
  } else {
    const thisYear = new Date().getFullYear()
    for (let i = 0; i < 4; i += 1) {
      const base = seeded(officeSeed + i + 400)
      points.push({
        bucket: String(thisYear - 3 + i),
        signed: Math.round(600 + base * 1800),
        thinking: Math.round(300 + seeded(officeSeed + i + 450) * 700),
        unprocessed: Math.round(100 + seeded(officeSeed + i + 500) * 400),
      })
    }
  }
  return points
}

function officeSeed(officeId: UUID | null): number {
  if (!officeId) return 7
  let h = 0
  for (let i = 0; i < officeId.length; i += 1) h += officeId.charCodeAt(i)
  return h
}

export interface StatsQuery {
  officeId: UUID | null
  granularity: Granularity
}

export const StatsApi = {
  async members(query: StatsQuery): Promise<MemberStats> {
    const series = buildSeries(query.granularity, officeSeed(query.officeId))
    return delay(clone({
      granularity: query.granularity,
      from: series[0]?.bucket ?? '',
      to: series[series.length - 1]?.bucket ?? '',
      series,
    }))
  },

  async summary(query: StatsQuery): Promise<StatsSummary> {
    const series = buildSeries(query.granularity, officeSeed(query.officeId))
    const signed = series.reduce((s, p) => s + p.signed, 0)
    const thinking = series.reduce((s, p) => s + p.thinking, 0)
    const unprocessed = series.reduce((s, p) => s + p.unprocessed, 0)
    return delay(clone({
      members_total: signed + thinking + unprocessed,
      signed,
      thinking,
      unprocessed,
      tasks_open: tasks.filter((t) => t.status !== 'done' && t.status !== 'canceled').length,
      tasks_done: tasks.filter((t) => t.status === 'done').length,
    }))
  },

  /** Экспорт текущего среза в CSV (кнопка «Скачать»). */
  async exportCsv(query: StatsQuery): Promise<Blob> {
    const { series } = await this.members(query)
    const header = 'Период;Подписали;Думают;Не обработаны'
    const rows = series.map((p) => `${p.bucket};${p.signed};${p.thinking};${p.unprocessed}`)
    const csv = [`# Экспорт ${ddmmyyyy(new Date())}`, header, ...rows].join('\n')
    return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  },
}
