import axios from 'axios'
import { config } from '@/shared/config'

/**
 * Единый axios-инстанс для будущего backend.
 * withCredentials=true — JWT в HttpOnly cookies (docs §10).
 * Сейчас сервисы работают на моках; этот клиент — точка переключения.
 */
export const http = axios.create({
  baseURL: config.API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})
