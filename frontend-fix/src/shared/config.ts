/**
 * Глобальная конфигурация фронта.
 * USE_MOCKS=true — данные берутся из in-memory мок-слоя (MVP, backend ещё нет).
 * При появлении backend сервисы переключаются на shared/api/http (один шов).
 */
export const config = {
  USE_MOCKS: true,
  API_BASE_URL: '/api/v1',
  MOCK_LATENCY_MS: 280,
} as const
