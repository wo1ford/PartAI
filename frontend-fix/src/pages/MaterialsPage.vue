<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import type { FileItem, FolderItem } from '@/shared/types'
import { FileApi } from '@/services/files.api'
import { useOfficeStore } from '@/stores/office.store'
import { ddmmyyyy, hhmm } from '@/shared/lib/format'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchBar from '@/shared/ui/SearchBar.vue'
import HexAvatar from '@/shared/ui/HexAvatar.vue'
import UploadDialog from '@/features/file/UploadDialog.vue'

const router = useRouter()
const office = useOfficeStore()
const toast = useToast()

const folders = ref<FolderItem[]>([])
const recent = ref<FileItem[]>([])
const search = ref('')
const uploadOpen = ref(false)

// ===== НОВЫЕ СОСТОЯНИЯ ДЛЯ ДИАЛОГОВ =====
const fileInfoOpen = ref(false)
const selectedFile = ref<FileItem | null>(null)

const shareOpen = ref(false)
const shareFile = ref<FileItem | null>(null)
const shareLink = ref('')
const shareLoading = ref(false)

// ===== НОВОЕ СОСТОЯНИЕ ДЛЯ "ВЕСЬ СПИСОК" =====
const historyOpen = ref(false)
const allRecentFiles = ref<FileItem[]>([])

// ===== ДИАЛОГ ПРЕДПРОСМОТРА (как в DiskPage) =====
const filePreviewOpen = ref(false)
const previewFile = ref<FileItem | null>(null)

// ===== ЛОГИКА ТИПОВ ФАЙЛОВ И ФОРМАТИРОВАНИЯ =====
function isImage(file: FileItem): boolean {
  return file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(file.name.split('.').pop()?.toLowerCase() || '')
}

function isVideo(file: FileItem): boolean {
  return file.type?.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(file.name.split('.').pop()?.toLowerCase() || '')
}

function isDocument(file: FileItem): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function load(): Promise<void> {
  if (!office.activeOfficeId) return
  const [f, r] = await Promise.all([
    FileApi.listFolders({ officeId: office.activeOfficeId, parentId: null }),
    FileApi.recent(office.activeOfficeId, 6),
  ])
  folders.value = f
  recent.value = r
}

// Функция загрузки всей истории (без лимита 6 штук)
async function loadFullHistory(): Promise<void> {
  if (!office.activeOfficeId) return
  const r = await FileApi.recent(office.activeOfficeId, 100)
  allRecentFiles.value = r
}

function openFolder(folder: FolderItem): void {
  router.push({ name: 'disk', query: { folder: folder.id } })
}

// ===== ФУНКЦИЯ ПЕРЕХОДА В ПАПКУ С ФАЙЛОМ =====
function goToFileLocation(file: FileItem): void {
  if (file.folder_id) {
    router.push({ name: 'disk', query: { folder: file.folder_id } })
  } else {
    router.push({ name: 'disk' }) // Если файл в корне
  }
}

// ===== ИНФОРМАЦИЯ О ФАЙЛЕ (старый диалог) =====
function openFileInfo(file: FileItem): void {
  selectedFile.value = file
  fileInfoOpen.value = true
}

// ===== ПРЕДПРОСМОТР ФАЙЛА (новый диалог как в DiskPage) =====
function openFilePreview(file: FileItem): void {
  previewFile.value = file
  filePreviewOpen.value = true
}

async function downloadFile(file: FileItem): Promise<void> {
  toast.add({ 
    severity: 'info', 
    summary: 'Скачивание файла', 
    detail: file.name, 
    life: 3000 
  })
  filePreviewOpen.value = false
  fileInfoOpen.value = false
}

// ===== ПОДЕЛИТЬСЯ =====
function openShare(file: FileItem): void {
  shareFile.value = file
  shareLink.value = ''
  shareOpen.value = true
}

async function generateShareLink(): Promise<void> {
  if (!shareFile.value) return
  shareLoading.value = true
  try {
    // Имитация генерации ссылки на сервере.
    const baseUrl = window.location.origin
    const shareId = Math.random().toString(36).substring(2, 10)
    shareLink.value = `${baseUrl}/share/${shareId}`
    
    await navigator.clipboard.writeText(shareLink.value)
    toast.add({ 
      severity: 'success', 
      summary: 'Ссылка создана', 
      detail: 'Ссылка скопирована в буфер обмена', 
      life: 3000 
    })
  } catch (error) {
    toast.add({ 
      severity: 'error', 
      summary: 'Ошибка', 
      detail: 'Не удалось создать ссылку', 
      life: 3000 
    })
  } finally {
    shareLoading.value = false
  }
}

async function copyShareLink(): Promise<void> {
  if (shareLink.value) {
    await navigator.clipboard.writeText(shareLink.value)
    toast.add({ 
      severity: 'success', 
      summary: 'Скопировано', 
      detail: 'Ссылка скопирована в буфер обмена', 
      life: 2000 
    })
  }
}

// ===== ОТКРЫТИЕ ИСТОРИИ =====
async function openHistory(): Promise<void> {
  historyOpen.value = true
  await loadFullHistory()
}

watch(() => office.activeOfficeId, load)
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Материалы">
      <template #search><SearchBar v-model="search" placeholder="Поиск" /></template>
      <template #actions>
        <Button label="Добавить" icon="pi pi-plus" @click="uploadOpen = true" />
        <Button label="Диск" icon="pi pi-server" severity="secondary" @click="router.push('/materials/disk')" />
      </template>
    </PageHeader>

    <section class="block">
      <h3 class="block__title muted">Недавно</h3>
      <div class="recent-folders">
        <div 
          v-for="f in folders.slice(0, 5)" 
          :key="f.id" 
          class="folder-icon" 
          @click="openFolder(f)"
        >
          <div class="folder-icon__name">{{ f.name }}</div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="block__head">
        <h3 class="block__title">Новые файлы</h3>
        <Button 
          label="Весь список" 
          text 
          icon="pi pi-arrow-right" 
          icon-pos="right" 
          @click="openHistory"
        />
      </div>

      <div class="files-table surface-card">
        <div v-for="file in recent" :key="file.id" class="file-row">
          <div class="file-row__author">
            <HexAvatar :name="file.uploaded_by_name" :color="file.uploaded_by_color" :size="36" />
            <span>{{ file.uploaded_by_name }}</span>
          </div>
          <span class="muted file-row__dep">{{ file.department_name || '—' }}</span>
          <span class="muted file-row__date">{{ ddmmyyyy(new Date(file.created_at)) }}</span>
          
          <!-- ===== НАЗВАНИЕ ФАЙЛА ТЕПЕРЬ ОТКРЫВАЕТ ПРЕДПРОСМОТР ===== -->
          <span class="file-row__name clickable" @click="openFilePreview(file)">
            {{ file.name }}
          </span>
          
          <div class="file-row__actions">
            <Button 
              icon="pi pi-ellipsis-h" 
              text 
              rounded 
              size="small" 
              aria-label="Ещё" 
              @click="openFileInfo(file)"
            />
            <Button 
              icon="pi pi-folder" 
              text 
              rounded 
              size="small" 
              aria-label="В папку" 
              @click="goToFileLocation(file)"
            />
            <Button 
              icon="pi pi-share-alt" 
              text 
              rounded 
              size="small" 
              aria-label="Поделиться" 
              @click="openShare(file)"
            />
          </div>
        </div>
      </div>
    </section>

    <UploadDialog
      v-if="office.activeOfficeId"
      v-model:visible="uploadOpen"
      :office-id="office.activeOfficeId"
      :folder-id="null"
      @uploaded="load"
    />

    <!-- ===== ДИАЛОГ: Информация о файле ===== -->
    <Dialog
      v-model:visible="fileInfoOpen"
      modal
      :header="selectedFile?.name"
      :style="{ width: '520px' }"
      :closable="true"
      class="file-info-dialog"
    >
      <div v-if="selectedFile" class="file-info-container">
        <!-- Предпросмотр (упрощенный) -->
        <div v-if="isImage(selectedFile)" class="file-preview">
          <img :src="selectedFile.url" :alt="selectedFile.name" class="preview-img" />
        </div>
        <div v-else-if="isVideo(selectedFile)" class="file-preview">
          <video :src="selectedFile.url" controls class="preview-video" />
        </div>
        <div v-else class="file-preview file-preview-placeholder">
          <i class="pi pi-file" />
          <span>Предпросмотр недоступен</span>
        </div>

        <!-- Информация -->
        <div class="file-meta">
          <div class="meta-item">
            <span class="meta-label">Название</span>
            <span class="meta-value">{{ selectedFile.name }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Размер</span>
            <span class="meta-value">{{ formatFileSize(selectedFile.size || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Добавил</span>
            <span class="meta-value">{{ selectedFile.uploaded_by_name }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Дата</span>
            <span class="meta-value">{{ ddmmyyyy(new Date(selectedFile.created_at)) }} в {{ hhmm(new Date(selectedFile.created_at)) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Отдел</span>
            <span class="meta-value">{{ selectedFile.department_name || '—' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Расположение</span>
            <span class="meta-value">
              {{ selectedFile.folder_path || 'Корень диска' }}
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button 
          label="Скачать" 
          icon="pi pi-download" 
          class="p-button-success" 
          @click="downloadFile(selectedFile!)"
        />
        <Button label="Закрыть" text @click="fileInfoOpen = false" />
      </template>
    </Dialog>

    <!-- ===== ДИАЛОГ: Поделиться ===== -->
    <Dialog
      v-model:visible="shareOpen"
      modal
      header="Поделиться файлом"
      :style="{ width: '480px' }"
      :closable="true"
    >
      <div v-if="shareFile" class="share-container">
        <div class="share-header">
          <i class="pi pi-share-alt share-icon" />
          <span class="share-title">{{ shareFile.name }}</span>
        </div>
        
        <div class="share-link-area">
          <div v-if="shareLink" class="link-box">
            <input 
              type="text" 
              readonly 
              :value="shareLink" 
              class="link-input" 
            />
            <Button 
              icon="pi pi-copy" 
              text 
              class="copy-btn" 
              @click="copyShareLink"
            />
          </div>
          
          <Button 
            v-else
            label="Создать ссылку" 
            icon="pi pi-link" 
            :loading="shareLoading" 
            class="generate-btn" 
            @click="generateShareLink"
          />
        </div>
        
        <div class="share-note">
          <i class="pi pi-info-circle" />
          <span>Ссылка ведёт на страницу просмотра файла на диске</span>
        </div>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="shareOpen = false" />
      </template>
    </Dialog>

    <!-- ===== ДИАЛОГ: История загрузок (Весь список) ===== -->
    <Dialog
      v-model:visible="historyOpen"
      modal
      header="История загрузок"
      :style="{ width: '800px', maxWidth: '90vw' }"
      :closable="true"
      class="history-dialog"
    >
      <div v-if="allRecentFiles.length > 0" class="history-table">
        <div v-for="file in allRecentFiles" :key="file.id" class="history-row">
          <div class="history-col author">
            <HexAvatar :name="file.uploaded_by_name" :color="file.uploaded_by_color" :size="28" />
            <span>{{ file.uploaded_by_name }}</span>
          </div>
          <div class="history-col date">{{ ddmmyyyy(new Date(file.created_at)) }}</div>
          <div class="history-col time">{{ hhmm(new Date(file.created_at)) }}</div>
          <div class="history-col name clickable" @click="openFilePreview(file)">{{ file.name }}</div>
          <div class="history-col actions">
            <Button 
              icon="pi pi-download" 
              text 
              rounded 
              size="small" 
              @click="downloadFile(file)"
            />
            <Button 
              icon="pi pi-info-circle" 
              text 
              rounded 
              size="small" 
              @click="openFileInfo(file)"
            />
          </div>
        </div>
      </div>
      <div v-else class="history-empty">
        <i class="pi pi-history" />
        <span>История загрузок пуста</span>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="historyOpen = false" />
      </template>
    </Dialog>

    <!-- ===== ДИАЛОГ: Предпросмотр файла (как в DiskPage) ===== -->
    <Dialog
      v-model:visible="filePreviewOpen"
      modal
      :header="previewFile?.name"
      :style="{ width: '700px' }"
      :closable="true"
      class="file-preview-dialog"
    >
      <div v-if="previewFile" class="file-preview-container">
        <div class="file-preview-area">
          <!-- Изображения -->
          <img 
            v-if="isImage(previewFile)" 
            :src="previewFile.url" 
            :alt="previewFile.name" 
            class="preview-img"
          />
          <!-- Видео -->
          <video 
            v-else-if="isVideo(previewFile)" 
            :src="previewFile.url" 
            controls 
            class="preview-video"
          />
          <!-- Документы (если есть public url, иначе иконка) -->
          <iframe 
            v-else-if="isDocument(previewFile)" 
            :src="previewFile.url" 
            class="preview-doc"
            frameborder="0"
          />
          <div v-else class="preview-placeholder">
            <i class="pi pi-file" />
            <p>Предпросмотр недоступен для этого типа файлов</p>
          </div>
        </div>
        <div class="file-info-row">
          <span><strong>Размер:</strong> {{ formatFileSize(previewFile.size || 0) }}</span>
          <span v-if="previewFile.created_at"><strong>Загружен:</strong> {{ ddmmyyyy(new Date(previewFile.created_at)) }}</span>
          <span v-if="previewFile.uploaded_by_name"><strong>Кем:</strong> {{ previewFile.uploaded_by_name }}</span>
        </div>
      </div>
      <template #footer>
        <Button 
          label="Скачать" 
          icon="pi pi-download" 
          class="p-button-success" 
          @click="downloadFile(previewFile!)"
        />
        <Button label="Закрыть" text @click="filePreviewOpen = false" />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
/* ===== ИКОНКА ПАПКИ ===== */
.recent-folders {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;
}

.folder-icon {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231abc9c'%3E%3Cpath d='M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 6px 12px rgba(26, 188, 156, 0.3));
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.folder-icon__name {
  position: absolute;
  bottom: 22%;
  left: 18%;
  color: #ffffff;
  font-weight: 600;
  font-size: 15px;
  text-align: left;
  line-height: 1.2;
  max-width: 75%;
  word-break: break-word;
}

.folder-icon:hover {
  transform: translateY(-4px) scale(1.05);
  filter: drop-shadow(0 10px 20px rgba(26, 188, 156, 0.4));
}

@media (max-width: 1100px) {
  .recent-folders { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .recent-folders { grid-template-columns: repeat(2, 1fr); }
}

/* ===== ОСТАЛЬНЫЕ СТИЛИ ===== */
.block { margin-bottom: 30px; }
.block__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.block__title { font-size: 18px; margin-bottom: 14px; }
.muted { color: #8898aa; }

.files-table {
  padding: 8px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.file-row { 
  display: grid; 
  grid-template-columns: 1.4fr 1fr 1fr 1.6fr auto; 
  align-items: center; 
  gap: 16px; 
  padding: 12px 0; 
  border-bottom: 1px solid #eef2f6; 
}
.file-row:last-child { border-bottom: 0; }
.file-row__author { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 14px; }
.file-row__dep, .file-row__date { font-size: 13px; color: #8898aa; }
.file-row__name { font-size: 14px; }

/* ===== КЛИКАБЕЛЬНОСТЬ НАЗВАНИЯ ===== */
.clickable {
  cursor: pointer;
  transition: color 0.2s ease;
}
.clickable:hover {
  color: #1abc9c;
}

.file-row__actions { display: flex; gap: 2px; justify-content: flex-end; }

/* ===== ДИАЛОГ: Информация о файле ===== */
.file-info-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.file-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f8f9fa;
  border-radius: 12px;
  min-height: 200px;
  max-height: 40vh;
  overflow: hidden;
}
.file-preview-placeholder {
  flex-direction: column;
  gap: 8px;
  color: #8898aa;
}
.file-preview-placeholder i { font-size: 48px; }
.preview-img {
  max-width: 100%;
  max-height: 40vh;
  object-fit: contain;
}
.preview-video {
  max-width: 100%;
  max-height: 40vh;
}
.file-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}
.meta-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f4f8;
}
.meta-item:last-child { border-bottom: none; }
.meta-label { color: #8898aa; font-size: 14px; }
.meta-value { font-weight: 600; font-size: 14px; color: #2c3e50; }

/* ===== ДИАЛОГ: Поделиться ===== */
.share-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}
.share-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.share-icon { color: #1abc9c; font-size: 24px; }
.share-title { font-weight: 600; font-size: 16px; color: #2c3e50; }
.share-link-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 12px;
}
.link-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 4px 4px 4px 12px;
}
.link-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #2c3e50;
  background: transparent;
  padding: 8px 0;
}
.copy-btn { color: #1abc9c; }
.generate-btn { width: 100%; background: #1abc9c; border: none; color: white; }
.share-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8898aa;
}

/* ===== ДИАЛОГ: История загрузок ===== */
.history-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
}
.history-row {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.8fr 1.4fr auto;
  align-items: center;
  gap: 16px;
  padding: 12px 8px;
  border-bottom: 1px solid #f0f4f8;
}
.history-row:last-child { border-bottom: none; }
.history-col.author {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  font-size: 14px;
}
.history-col.date, .history-col.time {
  font-size: 13px;
  color: #8898aa;
}
.history-col.name {
  font-size: 14px;
  font-weight: 500;
}
.history-col.actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #8898aa;
  gap: 12px;
}
.history-empty i { font-size: 48px; }

@media (max-width: 720px) {
  .history-row {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 0;
  }
  .history-col.date, .history-col.time { display: inline-block; }
  .history-col.actions { justify-content: flex-start; }
}

/* ===== ДИАЛОГ ПРЕДПРОСМОТРА ФАЙЛА (как в DiskPage) ===== */
.file-preview-dialog :deep(.p-dialog-header) {
  font-weight: 700;
  font-size: 18px;
}
.file-preview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.file-preview-area {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f8f9fa;
  border-radius: 12px;
  min-height: 300px;
  max-height: 60vh;
  overflow: auto;
  padding: 20px;
}
.preview-img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}
.preview-video {
  max-width: 100%;
  max-height: 60vh;
}
.preview-doc {
  width: 100%;
  height: 60vh;
}
.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #7f8c8d;
}
.preview-placeholder i {
  font-size: 48px;
}
.file-info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 12px 0 4px 0;
  font-size: 13px;
  color: #7f8c8d;
  border-top: 1px solid #f0f4f8;
}
.file-info-row span strong {
  color: #2c3e50;
}
</style>