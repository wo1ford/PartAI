<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useToast } from 'primevue/usetoast'
import { FileApi } from '@/services/files.api'
import { useAuthStore } from '@/stores/auth.store'
import { fileKind, formatFileSize, type FileKind } from '@/shared/lib/format'

const props = defineProps<{ officeId: string; folderId: string | null }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ (e: 'uploaded'): void }>()

const auth = useAuthStore()
const toast = useToast()

interface UploadItem {
  id: string
  name: string
  size: number
  loaded: number
  status: 'uploading' | 'done'
  kind: FileKind
}

const items = ref<UploadItem[]>([])
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
const urlValue = ref('')

const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF', doc: 'DOC', sheet: 'XLS', image: 'IMG', video: 'MP4', other: 'FILE',
}

function pickFiles(): void {
  fileInput.value?.click()
}

function onInput(e: Event): void {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

function onDrop(e: DragEvent): void {
  dragOver.value = false
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
}

function addFiles(list: FileList): void {
  Array.from(list).forEach((file) => uploadOne(file.name, file.size, file.type))
}

function uploadOne(name: string, size: number, mime: string): void {
  const item: UploadItem = {
    id: `${name}-${Date.now()}-${Math.random()}`,
    name,
    size: size || 120 * 1024,
    loaded: 0,
    status: 'uploading',
    kind: fileKind(name),
  }
  items.value.unshift(item)

  const timer = setInterval(() => {
    item.loaded = Math.min(item.size, item.loaded + item.size * 0.18)
    if (item.loaded >= item.size) {
      clearInterval(timer)
      item.status = 'done'
      void finalize(name, item.size, mime || 'application/octet-stream')
    }
  }, 130)
}

async function finalize(name: string, size: number, mime: string): Promise<void> {
  if (!auth.user) return
  await FileApi.create(props.officeId, {
    name,
    size_bytes: size,
    mime_type: mime,
    folder_id: props.folderId,
    author_id: auth.user.id,
    author_name: auth.user.full_name,
    author_color: auth.user.avatar_color,
  })
  emit('uploaded')
}

async function importFromUrl(): Promise<void> {
  const url = urlValue.value.trim()
  if (!url || !auth.user) return
  const name = url.split('/').pop() || 'файл'
  await FileApi.importUrl(props.officeId, url, name, props.folderId, {
    id: auth.user.id,
    name: auth.user.full_name,
    color: auth.user.avatar_color,
  })
  urlValue.value = ''
  toast.add({ severity: 'success', summary: 'Импортировано по ссылке', detail: name, life: 2200 })
  emit('uploaded')
}

function removeItem(id: string): void {
  items.value = items.value.filter((i) => i.id !== id)
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :style="{ width: '560px' }">
    <template #header>
      <div class="upload-head">
        <span class="upload-head__icon"><i class="pi pi-cloud-upload" /></span>
        <div>
          <strong>Загрузка файлов</strong>
          <p class="muted">Выберите и загрузите файлы по своему выбору</p>
        </div>
      </div>
    </template>

    <div
      class="dropzone"
      :class="{ 'is-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <i class="pi pi-cloud-upload" />
      <strong>Выберите файл или перетащите его сюда</strong>
      <span class="muted">JPEG, PNG, PDF, DOCS и прочие форматы</span>
      <Button label="Загрузить файлы" outlined @click="pickFiles" />
      <input ref="fileInput" type="file" multiple hidden @change="onInput" />
    </div>

    <div v-if="items.length" class="upload-list">
      <div v-for="item in items" :key="item.id" class="upload-item">
        <span class="upload-item__badge" :data-kind="item.kind">{{ KIND_LABEL[item.kind] }}</span>
        <div class="upload-item__body">
          <div class="upload-item__row">
            <strong>{{ item.name }}</strong>
            <Button
              :icon="item.status === 'done' ? 'pi pi-trash' : 'pi pi-times'"
              text rounded size="small"
              @click="removeItem(item.id)"
            />
          </div>
          <div class="upload-item__meta">
            {{ formatFileSize(item.loaded) }} из {{ formatFileSize(item.size) }} ·
            <span v-if="item.status === 'uploading'" class="status-up"><i class="pi pi-spin pi-spinner" /> Загрузка…</span>
            <span v-else class="status-done"><i class="pi pi-check-circle" /> Завершено</span>
          </div>
          <div v-if="item.status === 'uploading'" class="progress">
            <div class="progress__bar" :style="{ width: (item.loaded / item.size) * 100 + '%' }" />
          </div>
        </div>
      </div>
    </div>

    <div class="url-import">
      <div class="url-import__divider"><span>или</span></div>
      <label>Импорт из URL-ссылки</label>
      <div class="url-import__row">
        <IconField class="grow">
          <InputIcon class="pi pi-link" />
          <InputText v-model="urlValue" placeholder="Вставьте URL-адрес файла" fluid />
        </IconField>
        <Button label="Импорт" :disabled="!urlValue.trim()" @click="importFromUrl" />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.upload-head { display: flex; gap: 12px; align-items: center; }
.upload-head__icon { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--c-border); display: grid; place-items: center; color: var(--c-primary); }
.upload-head p { font-size: 12px; }

.dropzone {
  border: 2px dashed var(--c-border);
  border-radius: var(--radius-card);
  padding: 30px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  text-align: center;
  transition: all 0.15s ease;
}
.dropzone.is-over { border-color: var(--c-primary); background: var(--c-primary-050); }
.dropzone > i { font-size: 26px; color: var(--c-text-muted); }
.dropzone strong { font-size: 15px; }
.dropzone .p-button { margin-top: 8px; }

.upload-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.upload-item { display: flex; gap: 12px; align-items: flex-start; border: 1px solid var(--c-border); border-radius: 14px; padding: 12px; }
.upload-item__badge {
  font-size: 10px; font-weight: 700; color: #fff; background: var(--c-danger);
  border-radius: 7px; padding: 14px 8px; display: grid; place-items: center; min-width: 44px;
}
.upload-item__badge[data-kind='sheet'] { background: #21a366; }
.upload-item__badge[data-kind='image'] { background: #5b8def; }
.upload-item__badge[data-kind='doc'] { background: #2b579a; }
.upload-item__badge[data-kind='video'] { background: #8b5cf6; }
.upload-item__badge[data-kind='other'] { background: #8a97a8; }
.upload-item__body { flex: 1; min-width: 0; }
.upload-item__row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.upload-item__row strong { font-size: 14px; }
.upload-item__meta { font-size: 12px; color: var(--c-text-muted); margin: 2px 0 8px; }
.status-up { color: var(--c-warning); }
.status-done { color: var(--c-primary); }
.progress { height: 6px; background: var(--c-surface-2); border-radius: 999px; overflow: hidden; }
.progress__bar { height: 100%; background: var(--c-primary); border-radius: 999px; transition: width 0.13s linear; }

.url-import { margin-top: 18px; }
.url-import__divider { text-align: center; position: relative; margin: 8px 0 14px; }
.url-import__divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--c-border); }
.url-import__divider span { position: relative; background: var(--c-bg); padding: 0 12px; color: var(--c-text-soft); font-size: 12px; }
.url-import label { font-size: 13px; font-weight: 600; display: block; margin-bottom: 8px; }
.url-import__row { display: flex; gap: 10px; }
</style>
