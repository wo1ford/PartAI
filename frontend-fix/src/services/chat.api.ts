import type { ChatMessage } from '@/shared/types'
import { clone, delay, uid } from '@/mocks/util'

/**
 * Чат — заглушка MVP (docs §6.7, §10.10).
 * Контракт зарезервирован под RAG; логика появится после MVP.
 */
export const ChatApi = {
  async history(userName: string): Promise<ChatMessage[]> {
    return delay(clone<ChatMessage[]>([
      {
        id: uid('msg'),
        role: 'assistant',
        content: `Добрый день, ${userName}! Какие задачи на сегодня?`,
        created_at: new Date().toISOString(),
      },
    ]))
  },

  async send(_content: string): Promise<ChatMessage> {
    return delay({
      id: uid('msg'),
      role: 'assistant',
      content: 'Чат скоро заработает — в MVP это заглушка. Я подключусь к базе знаний (RAG) позже.',
      created_at: new Date().toISOString(),
    })
  },
}
