<script setup lang="ts">
import { computed, onMounted, ref, watch, h, defineComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { FileItem, FolderItem } from '@/shared/types'
import { FileApi } from '@/services/files.api'
import { useOfficeStore } from '@/stores/office.store'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchBar from '@/shared/ui/SearchBar.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import UploadDialog from '@/features/file/UploadDialog.vue'
// ИСПРАВЛЕНИЕ: Импортируем родные функции форматирования вместо date-fns
import { ddmm, hhmm } from '@/shared/lib/format'

// Локальный компонент иконки файла
const FileIcon = defineComponent({
  name: 'FileIcon',
  props: {
    file: { type: Object as () => FileItem, required: true }
  },
  setup(props) {
    const extension = computed(() => {
      if (!props.file?.name) return 'FILE'
      const ext = props.file.name.split('.').pop()?.toUpperCase() || ''
      return ext || 'FILE'
    })

    return () => {
      const classes = ['file-icon']
      
      return h('div', { class: classes.join(' ') }, [
        h('div', { class: 'file-icon__ext' }, extension.value)
      ])
    }
  }
})

const route = useRoute()
const router = useRouter()
const office = useOfficeStore()
const confirm = useConfirm()
const toast = useToast()

const rootFolders = ref<FolderItem[]>([])
const subFolders = ref<FolderItem[]>([])
const files = ref<FileItem[]>([])
const breadcrumb = ref<FolderItem[]>([])
const search = ref('')
const uploadOpen = ref(false)

const createFolderOpen = ref(false)
const newFolderName = ref('')

const downloadFolderOpen = ref(false)
const downloadFolderTarget = ref<FolderItem | null>(null)
const downloadArchiveName = ref('')
const downloadArchiveFormat = ref('zip')

const archiveFormats = ['zip', 'rar', '7z']

const renameOpen = ref(false)
const renameValue = ref('')
const renameTarget = ref<{ type: 'folder' | 'file'; id: string } | null>(null)

// ===== НОВЫЕ ДИАЛОГИ =====
const filePreviewOpen = ref(false)
const previewFile = ref<FileItem | null>(null)

const folderInfoOpen = ref(false)
const infoFolder = ref<FolderItem | null>(null)
const folderStats = ref<{ totalSize: number; fileCount: number; folderCount: number } | null>(null)

const menu = ref<InstanceType<typeof ContextMenu>>()
const ctxFolder = ref<FolderItem | null>(null)
const ctxFile = ref<FileItem | null>(null)
const ctxEmptyTarget = ref<HTMLElement | null>(null)
const isFolderEmpty = ref(false)

const currentFolderId = computed<string | null>(() => {
  const q = route.query.folder
  return typeof q === 'string' ? q : null
})
const isRoot = computed(() => currentFolderId.value === null)

const visibleFiles = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? files.value.filter((f) => f.name.toLowerCase().includes(q)) : files.value
})

const menuItems = computed<MenuItem[]>(() => {
  // Если ПКМ по пустой области внутри папки
  if (ctxFolder.value === null && ctxFile.value === null && ctxEmptyTarget.value) {
    return [
      { 
        label: 'Создать папку', 
        icon: 'pi pi-folder-plus', 
        command: () => { createFolderOpen.value = true }
      },
    ]
  }

  // Если ПКМ по папке
  if (ctxFolder.value) {
    const folder = ctxFolder.value
    return [
      { label: 'Открыть', icon: 'pi pi-folder-open', command: () => openFolder(folder) },
      { label: 'Скачать', icon: 'pi pi-download', command: () => openDownloadDialog(folder) },
      { label: 'Информация', icon: 'pi pi-info-circle', command: () => openFolderInfo(folder) },
      { label: 'Переименовать', icon: 'pi pi-pencil', command: () => startRename('folder', folder.id, folder.name) },
      { separator: true },
      { label: 'Удалить', icon: 'pi pi-trash', class: 'ctx-danger', command: () => deleteFolder(folder) },
    ]
  }

  // Если ПКМ по файлу
  if (ctxFile.value) {
    const file = ctxFile.value
    return [
      { label: 'Скачать', icon: 'pi pi-download', command: () => downloadFile(file) },
      { label: 'Переименовать', icon: 'pi pi-pencil', command: () => startRename('file', file.id, file.name) },
      { separator: true },
      { label: 'Удалить', icon: 'pi pi-trash', class: 'ctx-danger', command: () => removeFile(file) },
    ]
  }

  return []
})

// Форматирование размера файла
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ===== ЛОГИКА ИНФОРМАЦИИ О ПАПКЕ =====
function openFolderInfo(folder: FolderItem): void {
  infoFolder.value = folder
  folderInfoOpen.value = true
  // Собираем статистику (суммируем файлы и папки в текущей директории)
  const folderFiles = files.value.filter(f => f.folder_id === folder.id || f.folder_id === currentFolderId.value)
  const folderSubs = subFolders.value.filter(f => f.parent_id === folder.id || f.parent_id === currentFolderId.value)
  
  let totalSize = 0
  folderFiles.forEach(f => {
    if (f.size) totalSize += f.size
    else totalSize += 1024
  })

  folderStats.value = {
    totalSize: totalSize,
    fileCount: folderFiles.length,
    folderCount: folderSubs.length
  }
}

// ===== ЛОГИКА ПРЕДПРОСМОТРА ФАЙЛА =====
function openFilePreview(file: FileItem): void {
  previewFile.value = file
  filePreviewOpen.value = true
}

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

async function downloadFile(file: FileItem): Promise<void> {
  toast.add({ 
    severity: 'info', 
    summary: 'Скачивание файла', 
    detail: file.name, 
    life: 3000 
  })
  filePreviewOpen.value = false
}

async function downloadFolder(): Promise<void> {
  const name = downloadArchiveName.value.trim() || 'archive'
  const format = downloadArchiveFormat.value
  toast.add({ 
    severity: 'info', 
    summary: 'Скачивание начато', 
    detail: `${name}.${format} (${format.toUpperCase()})`, 
    life: 3000 
  })
  downloadFolderOpen.value = false
}

async function load(): Promise<void> {
  if (!office.activeOfficeId) return
  const officeId = office.activeOfficeId
  const [root, subs, fls, crumb] = await Promise.all([
    FileApi.listFolders({ officeId, parentId: null }),
    FileApi.listFolders({ officeId, parentId: currentFolderId.value }),
    FileApi.listFiles({ officeId, folderId: currentFolderId.value }),
    FileApi.breadcrumb(currentFolderId.value),
  ])
  rootFolders.value = root
  subFolders.value = subs
  files.value = fls
  breadcrumb.value = crumb

  isFolderEmpty.value = subs.length === 0 && fls.length === 0
}

function openFolder(folder: FolderItem): void {
  router.push({ name: 'disk', query: { folder: folder.id } })
}
function goRoot(): void { router.push({ name: 'disk' }) }
function goUp(): void {
  const parent = breadcrumb.value[breadcrumb.value.length - 2]
  if (parent) openFolder(parent)
  else goRoot()
}

function onFolderContext(folder: FolderItem, event: MouseEvent): void {
  ctxFolder.value = folder
  ctxFile.value = null
  ctxEmptyTarget.value = null
  menu.value?.show(event)
}
function onFileContext(file: FileItem, event: MouseEvent): void {
  ctxFile.value = file
  ctxFolder.value = null
  ctxEmptyTarget.value = null
  menu.value?.show(event)
}

function onEmptyContext(event: MouseEvent): void {
  if (!isRoot.value && isFolderEmpty.value) {
    ctxFolder.value = null
    ctxFile.value = null
    ctxEmptyTarget.value = event.target as HTMLElement
    menu.value?.show(event)
  }
}

async function createFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name || !office.activeOfficeId) return
  await FileApi.createFolder(office.activeOfficeId, name, currentFolderId.value)
  toast.add({ severity: 'success', summary: 'Папка создана', detail: name, life: 2000 })
  newFolderName.value = ''
  createFolderOpen.value = false
  await load()
}

function openDownloadDialog(folder: FolderItem): void {
  downloadFolderTarget.value = folder
  downloadArchiveName.value = folder.name
  downloadArchiveFormat.value = 'zip'
  downloadFolderOpen.value = true
}

function startRename(type: 'folder' | 'file', id: string, current: string): void {
  renameTarget.value = { type, id }
  renameValue.value = current
  renameOpen.value = true
}
async function applyRename(): Promise<void> {
  const target = renameTarget.value
  const name = renameValue.value.trim()
  if (!target || !name) return
  if (target.type === 'folder') await FileApi.renameFolder(target.id, name)
  else await FileApi.renameFile(target.id, name)
  toast.add({ severity: 'success', summary: 'Переименовано', life: 1800 })
  renameOpen.value = false
  await load()
}

function deleteFolder(folder: FolderItem): void {
  confirm.require({
    message: `Удалить папку «${folder.name}» со всем содержимым?`,
    header: 'Удаление папки',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await FileApi.deleteFolder(folder.id)
      toast.add({ severity: 'success', summary: 'Папка удалена', life: 2000 })
      if (currentFolderId.value === folder.id) goUp()
      else await load()
    },
  })
}

function removeFile(file: FileItem): void {
  confirm.require({
    message: `Удалить файл «${file.name}»?`,
    header: 'Удаление',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await FileApi.remove(file.id)
      toast.add({ severity: 'success', summary: 'Файл удалён', life: 2000 })
      await load()
    },
  })
}

watch([currentFolderId, () => office.activeOfficeId], load)
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Диск">
      <template #search>
        <div class="disk-search">
          <Button v-if="!isRoot" icon="pi pi-arrow-left" rounded text aria-label="Назад" @click="goUp" />
          <SearchBar
            v-model="search"
            :placeholder="isRoot ? 'Поиск' : 'Диск / ' + (breadcrumb[breadcrumb.length - 1]?.name ?? '')"
          />
        </div>
      </template>
      <template #actions>
        <Button label="Создать папку" icon="pi pi-folder-plus" severity="secondary" @click="createFolderOpen = true" />
        <Button label="Добавить" icon="pi pi-plus" @click="uploadOpen = true" />
      </template>
    </PageHeader>

    <p class="disk-hint muted"><i class="pi pi-info-circle" /> Правый клик по папке или файлу — скачать / переименовать / удалить</p>

    <!-- Корень -->
    <div v-if="isRoot" class="root-grid">
      <div 
        v-for="f in rootFolders" 
        :key="f.id" 
        class="folder-icon" 
        @click="openFolder(f)"
        @contextmenu.prevent="onFolderContext(f, $event)"
      >
        <div class="folder-icon__name">{{ f.name }}</div>
      </div>
    </div>

    <!-- Внутри папки -->
    <div v-else class="folder-view">
      <aside class="folder-tree scroll">
        <Button icon="pi pi-arrow-up" rounded text class="tree-nav" aria-label="Вверх" @click="goUp" />
        <div 
          v-for="f in rootFolders" 
          :key="f.id" 
          class="folder-icon compact" 
          :class="{ active: breadcrumb[0]?.id === f.id }"
          @click="openFolder(f)"
          @contextmenu.prevent="onFolderContext(f, $event)"
        >
          <div class="folder-icon__name">{{ f.name }}</div>
        </div>
      </aside>

      <div class="folder-content">
        <h2 class="folder-content__crumb">
          Диск<template v-for="c in breadcrumb" :key="c.id"> / {{ c.name }}</template>
        </h2>

        <!-- СЕКЦИЯ 1: Только папки -->
        <div v-if="subFolders.length" class="content-grid folders-grid">
          <div 
            v-for="f in subFolders" 
            :key="f.id" 
            class="folder-icon" 
            @click="openFolder(f)"
            @contextmenu.prevent="onFolderContext(f, $event)"
          >
            <div class="folder-icon__name">{{ f.name }}</div>
          </div>
        </div>

        <!-- Разделитель между папками и файлами -->
        <div v-if="subFolders.length && visibleFiles.length" class="divider"></div>

        <!-- СЕКЦИЯ 2: Только файлы -->
        <div v-if="visibleFiles.length" class="content-grid files-grid">
          <div
            v-for="file in visibleFiles"
            :key="file.id"
            class="file-wrap"
            @click="openFilePreview(file)"
            @contextmenu.prevent="onFileContext(file, $event)"
          >
            <FileIcon :file="file" />
            <div class="file-name">{{ file.name }}</div>
          </div>
        </div>

        <!-- Состояние пустой папки (с поддержкой ПКМ) -->
        <div 
          v-if="!subFolders.length && !visibleFiles.length" 
          @contextmenu.prevent="onEmptyContext($event)"
        >
          <EmptyState 
            icon="pi pi-folder-open" 
            title="Папка пуста" 
            subtitle="Загрузите файл или создайте папку (ПКМ для быстрого создания)" 
          />
        </div>
      </div>
    </div>

    <ContextMenu ref="menu" :model="menuItems" />

    <!-- ДИАЛОГ: Информация о папке -->
    <Dialog
      v-model:visible="folderInfoOpen"
      modal
      header="Информация о папке"
      :style="{ width: '420px' }"
      :closable="true"
    >
      <div v-if="infoFolder && folderStats" class="folder-info-dialog">
        <div class="info-item">
          <span class="info-label">Название</span>
          <span class="info-value">{{ infoFolder.name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Размер</span>
          <span class="info-value">{{ formatFileSize(folderStats.totalSize) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Вложенных папок</span>
          <span class="info-value">{{ folderStats.folderCount }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Файлов внутри</span>
          <span class="info-value">{{ folderStats.fileCount }}</span>
        </div>
        <div v-if="infoFolder.created_at" class="info-item">
          <span class="info-label">Дата создания</span>
          <!-- ИСПРАВЛЕНИЕ: используем ddmm + hhmm -->
          <span class="info-value">{{ ddmm(new Date(infoFolder.created_at)) }} {{ hhmm(new Date(infoFolder.created_at)) }}</span>
        </div>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="folderInfoOpen = false" />
      </template>
    </Dialog>

    <!-- ДИАЛОГ: Предпросмотр файла -->
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
          <span v-if="previewFile.created_at"><strong>Загружен:</strong> {{ ddmm(new Date(previewFile.created_at)) }}</span>
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

    <!-- Диалог: Скачать папку -->
    <Dialog 
      v-model:visible="downloadFolderOpen" 
      modal 
      header="Скачать папку" 
      :style="{ width: '460px' }"
      :closable="true"
    >
      <div class="download-dialog">
        <div class="field">
          <label>Название</label>
          <InputText v-model="downloadArchiveName" placeholder="Имя архива" fluid />
        </div>
        
        <div class="field">
          <label>Вид архива</label>
          <div class="format-toggle">
            <button 
              v-for="fmt in archiveFormats" 
              :key="fmt"
              class="format-btn"
              :class="{ 'format-btn--active': downloadArchiveFormat === fmt }"
              @click="downloadArchiveFormat = fmt"
            >
              {{ fmt.toUpperCase() }}
            </button>
          </div>
        </div>

        <div class="download-actions">
          <Button 
            label="Скачать" 
            icon="pi pi-download" 
            class="p-button-success p-button-lg download-btn"
            @click="downloadFolder"
          />
        </div>
      </div>
    </Dialog>

    <UploadDialog
      v-if="office.activeOfficeId"
      v-model:visible="uploadOpen"
      :office-id="office.activeOfficeId"
      :folder-id="currentFolderId"
      @uploaded="load"
    />

    <Dialog v-model:visible="createFolderOpen" modal header="Новая папка" :style="{ width: '400px' }">
      <div class="field">
        <label>Название папки</label>
        <InputText v-model="newFolderName" placeholder="Например: Договоры" fluid @keyup.enter="createFolder" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="createFolderOpen = false" />
        <Button label="Создать" icon="pi pi-check" :disabled="!newFolderName.trim()" @click="createFolder" />
      </template>
    </Dialog>

    <Dialog v-model:visible="renameOpen" modal header="Переименовать" :style="{ width: '400px' }">
      <div class="field">
        <label>Новое название</label>
        <InputText v-model="renameValue" fluid @keyup.enter="applyRename" />
      </div>
      <template #footer>
        <Button label="Отмена" text @click="renameOpen = false" />
        <Button label="Сохранить" icon="pi pi-check" :disabled="!renameValue.trim()" @click="applyRename" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* ===== ИКОНКА ПАПКИ (Идеальный SVG-стиль) ===== */
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

.folder-icon:hover {
  transform: translateY(-4px) scale(1.05);
  filter: drop-shadow(0 10px 20px rgba(26, 188, 156, 0.4));
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

.folder-icon.compact {
  aspect-ratio: 1 / 0.9;
  width: 80%;
  filter: drop-shadow(0 2px 6px rgba(26, 188, 156, 0.15));
}
.folder-icon.compact .folder-icon__name {
  font-size: 12px;
  bottom: 18%;
  left: 20%;
}
.folder-icon.compact:hover { transform: translateY(-2px); }
.folder-icon.compact.active {
  filter: drop-shadow(0 4px 10px rgba(26, 188, 156, 0.4)) brightness(1.05);
  transform: scale(1.03);
}

/* ===== ИКОНКА ФАЙЛА (Зеленый лист с расширением) ===== */
.file-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  width: 100%;
}
.file-wrap:hover { transform: translateY(-3px); }

.file-icon {
  position: relative;
  width: 100%;
  max-width: 120px;
  aspect-ratio: 0.85 / 1;
  background: #1abc9c;
  border-radius: 8px 20px 8px 8px; /* Загнутый угол справа-сверху */
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}
.file-icon::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 28%;
  height: 28%;
  background: #ffffff;
  border-radius: 0 20px 0 8px;
  box-shadow: -3px 3px 6px rgba(0, 0, 0, 0.05); /* Мягкая тень сгиба */
}

.file-icon__ext {
  position: absolute;
  bottom: 20%;
  left: 18%;
  color: #ffffff;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  line-height: 1;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 2;
}

.file-name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #2c3e50;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ===== ПЕРЕКЛЮЧАТЕЛЬ ФОРМАТОВ (плитки) ===== */
.format-toggle {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.format-btn {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  color: #7f8c8d;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.format-btn:hover {
  border-color: #b0b0b0;
  background: #f0f0f0;
}

.format-btn--active {
  border-color: #1abc9c;
  background: #1abc9c;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(26, 188, 156, 0.3);
}

.format-btn--active:hover {
  background: #16a085;
  border-color: #16a085;
}

/* ===== ОКНО СКАЧИВАНИЯ ===== */
.download-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}
.download-actions {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.download-btn {
  width: 100%;
  font-size: 16px;
  padding: 12px;
  background: #1abc9c;
  border-color: #1abc9c;
}
.download-btn:hover {
  background: #16a085;
  border-color: #16a085;
}

/* ===== ДИАЛОГ ИНФОРМАЦИИ ===== */
.folder-info-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f4f8;
}
.info-item:last-child {
  border-bottom: none;
}
.info-label {
  color: #7f8c8d;
  font-size: 14px;
}
.info-value {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
}

/* ===== ДИАЛОГ ПРЕДПРОСМОТРА ФАЙЛА ===== */
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

/* ===== ОБЩИЕ СТИЛИ ЛЕЙАУТА ===== */
.disk-search { display: flex; align-items: center; gap: 8px; }
.disk-hint { font-size: 12px; margin: -8px 0 18px; display: flex; align-items: center; gap: 6px; }
.root-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 22px; }

.folder-view { display: grid; grid-template-columns: 160px 1fr; gap: 24px; }
.folder-tree { display: flex; flex-direction: column; gap: 10px; max-height: 70vh; overflow-y: auto; padding-right: 6px; }
.tree-nav { align-self: center; background: var(--c-primary-050); margin-bottom: 10px; }
.folder-content__crumb { font-size: 22px; margin-bottom: 22px; }

/* ОТДЕЛЬНЫЕ СЕТКИ ДЛЯ ПАПОК И ФАЙЛОВ */
.content-grid { 
  display: grid; 
  grid-template-columns: repeat(5, 1fr); 
  gap: 22px;
  align-items: start;
}

/* Разделитель между папками и файлами */
.divider {
  height: 10px;
  width: 100%;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 600; color: var(--c-text-muted); }

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 1100px) {
  .root-grid, .content-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 720px) {
  .root-grid, .content-grid { grid-template-columns: repeat(2, 1fr); }
  .folder-view { grid-template-columns: 1fr; }
  .folder-tree { flex-direction: row; flex-wrap: wrap; max-height: none; gap: 6px; padding: 0; }
  .folder-tree .folder-icon { width: 50px; }
}
</style>