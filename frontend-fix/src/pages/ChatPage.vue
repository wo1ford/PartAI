<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import type { ChatMessage } from '@/shared/types'
import { ChatApi } from '@/services/chat.api'
import { useAuthStore } from '@/stores/auth.store'
import { firstName } from '@/shared/lib/format'
import { useToast } from 'primevue/usetoast'

const auth = useAuthStore()
const toast = useToast()

const messages = ref<ChatMessage[]>([])
const draft = ref('')
const sending = ref(false)
const scroller = ref<HTMLElement>()

// ===== ЛОГИКА ВЛОЖЕНИЙ =====
const fileInputRef = ref<HTMLInputElement | null>(null)
const attachments = ref<{ file: File; preview?: string }[]>([])

// Функция открытия диалога выбора файла
const triggerFileUpload = (type: 'image' | 'file') => {
  if (!fileInputRef.value) return
  // Если выбираем только картинки, ограничиваем accept, иначе всё
  if (type === 'image') {
    fileInputRef.value.accept = 'image/*'
  } else {
    fileInputRef.value.accept = '*'
  }
  fileInputRef.value.click()
}

// Обработка выбранных файлов
const handleFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  Array.from(files).forEach((file) => {
    // Проверка размера (например, до 10МБ)
    if (file.size > 10 * 1024 * 1024) {
      toast.add({ severity: 'warn', summary: 'Файл слишком большой', detail: `${file.name} (макс. 10 МБ)`, life: 3000 })
      return
    }

    const newAttachment: { file: File; preview?: string } = { file }
    
    // Если это картинка, создаем превью
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        newAttachment.preview = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
    attachments.value.push(newAttachment)
  })

  // Сброс инпута, чтобы можно было повторно выбрать тот же файл
  target.value = ''
}

// Удаление вложения
const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

// Форматирование размера
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ===== ОСНОВНАЯ ЛОГИКА ЧАТА =====
const onlyGreeting = computed(() => messages.value.length <= 1)

const quickActions = [
  { title: 'Дизайнер', icon: '🎨', prompt: 'Привет! Я хочу, чтобы ты работал как профессиональный UI/UX Дизайнер. Помоги мне с дизайном интерфейсов, подбором цветов и типографики.' },
  { title: 'Копирайтер', icon: '✍️', prompt: 'Привет! С этого момента ты работаешь как Креативный Копирайтер. Пиши тексты для соцсетей, лендингов и рекламных кампаний.' },
  { title: 'Аналитик', icon: '📊', prompt: 'Привет! Активируй режим Бизнес-Аналитика. Помоги мне анализировать данные, строить графики и находить закономерности.' },
  { title: 'Кодер', icon: '💻', prompt: 'Привет! Работай как Senior Fullstack Разработчик. Пиши чистый код, объясняй архитектуру и рефакторь старые проекты.' },
  { title: 'Исследователь', icon: '🔬', prompt: 'Привет! Ты Исследователь. Ищи глубокие инсайты, проверяй факты и строй логические цепочки по любым запросам.' },
  { title: 'Менеджер', icon: '📋', prompt: 'Привет! Активируй режим Проектного Менеджера. Помоги мне с планированием, тайм-менеджментом и распределением задач.' },
]

async function load(): Promise<void> {
  messages.value = await ChatApi.history(auth.user ? firstName(auth.user.full_name) : 'коллега')
}

async function send(messageText?: string): Promise<void> {
  const text = messageText || draft.value.trim()
  if ((!text && attachments.value.length === 0) || sending.value) return
  
  // Если есть вложения, создаем составное сообщение
  const hasAttachments = attachments.value.length > 0
  
  // Добавляем сообщение пользователя в чат (включая вложения)
  messages.value.push({ 
    id: `u-${Date.now()}`, 
    role: 'user', 
    content: text || '📎 Вложение', 
    created_at: new Date().toISOString(),
    attachments: hasAttachments ? attachments.value.map(a => ({ 
      name: a.file.name, 
      size: a.file.size, 
      type: a.file.type,
      preview: a.preview || null
    })) : undefined
  })

  // Сбрасываем поле и вложения
  draft.value = ''
  const attachmentsCopy = [...attachments.value]
  attachments.value = []
  
  sending.value = true
  await scrollDown()

  try {
    // ЗАМЕЧАНИЕ: В реальном API вам нужно будет отправлять FormData с файлами.
    // Сейчас это заглушка, которая эмулирует ответ, игнорируя файлы.
    const reply = await ChatApi.send(text, attachmentsCopy)
    messages.value.push(reply)
    await scrollDown()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось отправить сообщение', life: 4000 })
    // Возвращаем вложения в поле ввода при ошибке
    attachments.value = attachmentsCopy
  } finally {
    sending.value = false
  }
}

async function scrollDown(): Promise<void> {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

onMounted(load)
</script>

<template>
  <div class="chat-page">
    <div class="chat-container">
      
      <!-- ===== ПРИВЕТСТВЕННЫЙ ЭКРАН ===== -->
      <div v-if="onlyGreeting" class="welcome-screen">
        <div class="hero-avatar">
          <span class="ai-logo-text">AI</span>
          <span class="status-dot"></span>
        </div>
        <h1 class="hero-title">Claude AI</h1>
        <p class="hero-subtitle">Ваш персональный ИИ-ассистент для работы и творчества</p>

        <div class="quick-grid">
          <div v-for="action in quickActions" :key="action.title" class="action-card" @click="send(action.prompt)">
            <div class="action-icon">{{ action.icon }}</div>
            <div class="action-title">{{ action.title }}</div>
          </div>
        </div>

        <div v-if="messages.length === 1" class="welcome-bubble">
          <div class="bubble-content">
            <span class="bubble-text">{{ messages[0]?.content }}</span>
          </div>
        </div>
      </div>

      <!-- ===== ЛЕНТА ЧАТА ===== -->
      <div v-else ref="scroller" class="chat-feed scroll">
        <div v-for="m in messages" :key="m.id" class="msg" :class="m.role === 'user' ? 'msg--user' : 'msg--bot'">
          <div class="msg__avatar-wrapper">
            <div class="msg__avatar" :class="m.role === 'user' ? 'avatar-user' : 'avatar-bot'">
              <span v-if="m.role === 'user'" style="font-size: 20px; line-height: 1;">🙂</span>
              <span v-else class="ai-logo-text-small">AI</span>
            </div>
          </div>
          
          <div class="msg__bubble-wrapper">
            <!-- Текст сообщения -->
            <div class="msg__bubble" v-if="m.content && m.content !== '📎 Вложение'">{{ m.content }}</div>
            
            <!-- Отображение вложений в чате -->
            <div v-if="m.attachments && m.attachments.length > 0" class="msg__attachments">
              <div v-for="(att, idx) in m.attachments" :key="idx" class="att-item">
                <!-- Если это картинка, показываем превью -->
                <img v-if="att.preview" :src="att.preview" alt="Attachment" class="att-image" />
                <!-- Если это файл, показываем иконку и название -->
                <div v-else class="att-file">
                  <i class="pi pi-file"></i>
                  <span class="att-name">{{ att.name }}</span>
                  <span class="att-size">{{ formatSize(att.size) }}</span>
                </div>
              </div>
            </div>
            
            <div class="msg__time">{{ new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}</div>
          </div>
        </div>
      </div>

      <!-- ===== КОМПОЗЕР ===== -->
      <div class="chat-composer">
        <!-- Скрытый инпут для загрузки файлов -->
        <input 
          ref="fileInputRef" 
          type="file" 
          multiple 
          class="hidden-input" 
          @change="handleFileSelected"
        />

        <div class="composer-inner">
          
          <!-- Зона отображения прикрепленных файлов -->
          <div v-if="attachments.length > 0" class="attachments-preview">
            <div v-for="(att, idx) in attachments" :key="idx" class="att-preview-item">
              <img v-if="att.preview" :src="att.preview" class="att-thumb" />
              <div v-else class="att-file-icon"><i class="pi pi-file"></i></div>
              <span class="att-filename">{{ att.file.name }}</span>
              <Button icon="pi pi-times" text size="small" class="remove-att-btn" @click="removeAttachment(idx)" />
            </div>
          </div>

          <div class="input-area">
            <div class="composer-addon">
              <Button icon="pi pi-plus" text rounded size="small" class="addon-btn" />
            </div>
            
            <Textarea
              v-model="draft"
              placeholder="Напишите сообщение Claude..."
              rows="1"
              auto-resize
              class="composer-input"
              @keydown.enter.exact.prevent="send"
            />
          </div>

          <div class="composer-tools">
            <div class="tools-left">
              <!-- Кнопка прикрепления файлов (скрепка) -->
              <Button 
                icon="pi pi-paperclip" 
                text rounded size="small" 
                class="tool-btn" 
                @click="triggerFileUpload('file')"
              />
              <!-- Кнопка прикрепления изображений -->
              <Button 
                icon="pi pi-image" 
                text rounded size="small" 
                class="tool-btn" 
                @click="triggerFileUpload('image')"
              />
            </div>
            
            <div class="tools-right">
              <Button 
                icon="pi pi-arrow-up" 
                rounded 
                class="send-btn" 
                :loading="sending" 
                :disabled="(!draft.trim() && attachments.length === 0) || sending" 
                @click="send"
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ===== СТРУКТУРА СТРАНИЦЫ ===== */
.chat-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  height: calc(100vh - 80px);
  padding: 0 20px 20px 20px;
  background: #f8fafc;
  overflow: hidden;
}
.chat-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 920px;
  height: 100%;
  gap: 16px;
}

.hidden-input {
  display: none;
}

/* ===== ПРИВЕТСТВЕННЫЙ ЭКРАН ===== */
.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0 20px 0;
  gap: 24px;
  animation: fadeInUp 0.6s ease-out;
}
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

.hero-avatar {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(26, 188, 156, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-logo-text {
  font-size: 48px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: linear-gradient(135deg, #1abc9c 0%, #16a085 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -2px;
  filter: drop-shadow(0 2px 4px rgba(26, 188, 156, 0.2));
}
.status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: #22c55e;
  border: 3px solid #ffffff;
  border-radius: 50%;
}

.hero-title {
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  letter-spacing: -0.5px;
}
.hero-subtitle {
  font-size: 16px;
  color: #64748b;
  margin: -8px 0 0 0;
}

/* ===== КАРТОЧКИ БЫСТРЫХ ДЕЙСТВИЙ ===== */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 600px;
  width: 100%;
  margin-top: 4px;
}
.action-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.action-card:hover {
  transform: translateY(-3px);
  border-color: #1abc9c;
  box-shadow: 0 8px 16px rgba(26, 188, 156, 0.12);
}
.action-icon { font-size: 28px; }
.action-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.welcome-bubble {
  margin-top: 12px;
  background: #f1f5f9;
  padding: 16px 24px;
  border-radius: 18px;
  max-width: 80%;
}
.bubble-content { display: flex; align-items: center; gap: 8px; color: #334155; font-size: 15px; }

/* ===== ЛЕНТА ЧАТА ===== */
.chat-feed {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.msg {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 8px;
  animation: msgIn 0.3s ease;
}
@keyframes msgIn {
  0% { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}

.msg--user { flex-direction: row-reverse; }
.msg__avatar-wrapper { flex-shrink: 0; }
.msg__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-user { background: #dbeafe; }
.avatar-bot { 
  background: #e6f7f0; 
}

.ai-logo-text-small {
  font-size: 16px;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1abc9c;
  letter-spacing: -1px;
}

.msg__bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.msg--user .msg__bubble-wrapper { align-items: flex-end; }

.msg__bubble {
  padding: 10px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  max-width: 80%;
  word-wrap: break-word;
}
.msg--bot .msg__bubble {
  background: #ffffff;
  border: 1px solid #f0f4f8;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.msg--user .msg__bubble {
  background: #1abc9c;
  color: #ffffff;
}
.msg__time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  padding: 0 4px;
}

/* ===== ВЛОЖЕНИЯ В ЧАТЕ ===== */
.msg__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 80%;
  margin-top: 4px;
}
.att-item {
  border-radius: 10px;
  overflow: hidden;
  background: #f1f5f9;
  max-width: 200px;
}
.att-image {
  width: 100%;
  height: auto;
  max-height: 150px;
  object-fit: cover;
  display: block;
}
.att-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #475569;
}
.att-file i { font-size: 18px; color: #64748b; }
.att-name { 
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}
.att-size { font-size: 11px; color: #94a3b8; }

/* ===== КОМПОЗЕР ===== */
.chat-composer {
  padding: 8px 0;
  width: 100%;
}
.composer-inner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 8px 12px 8px 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: border-color 0.2s;
}
.composer-inner:focus-within {
  border-color: #1abc9c;
  box-shadow: 0 4px 20px rgba(26, 188, 156, 0.08);
}

/* Превью вложений перед отправкой */
.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.att-preview-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 4px 8px 4px 4px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  max-width: 200px;
}
.att-thumb {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
}
.att-file-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 4px;
}
.att-filename {
  font-size: 13px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}
.remove-att-btn {
  color: #94a3b8 !important;
  padding: 0 !important;
  width: 20px !important;
  height: 20px !important;
}
.remove-att-btn:hover { color: #ef4444 !important; }

.input-area {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}
.composer-addon .addon-btn {
  color: #94a3b8;
  margin-top: 4px;
}
.composer-addon .addon-btn:hover { color: #1abc9c; background: #e6f7f0; }

.composer-input {
  width: 100%;
  background: transparent;
  border: none;
  resize: none;
  font-size: 15px;
  color: #1e293b;
  padding: 8px 0;
  min-height: 44px;
  outline: none;
  box-shadow: none !important;
}
.composer-input::placeholder { color: #94a3b8; }

.composer-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid #f1f5f9;
}
.tools-left { display: flex; gap: 4px; }
.tool-btn { color: #94a3b8; }
.tool-btn:hover { color: #1e293b; background: #f1f5f9; }

.send-btn {
  background: #1abc9c !important;
  border: none !important;
  color: #ffffff !important;
  width: 36px;
  height: 36px;
  box-shadow: 0 2px 8px rgba(26, 188, 156, 0.25);
}
.send-btn:hover { background: #16a085 !important; box-shadow: 0 4px 12px rgba(26, 188, 156, 0.35); }
.send-btn:disabled { background: #cbd5e1 !important; box-shadow: none; }

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 640px) {
  .chat-page { padding: 0 8px 8px 8px; height: calc(100vh - 60px); }
  .quick-grid { grid-template-columns: repeat(2, 1fr); }
  .action-card { padding: 14px 8px; }
  .composer-inner { border-radius: 16px; padding: 6px 12px 6px 12px; }
  .hero-title { font-size: 26px; }
  .msg__bubble { max-width: 90%; font-size: 14px; }
}
</style>