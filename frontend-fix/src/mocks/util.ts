import { config } from '@/shared/config'

/** Имитация сетевой задержки для мок-слоя. */
export function delay<T>(value: T, ms = config.MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

/** Глубокая копия — чтобы мутации UI не текли в "БД" напрямую. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
