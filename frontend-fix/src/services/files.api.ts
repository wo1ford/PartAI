import type { FileItem, FolderItem, UUID } from '@/shared/types'
import { files, folders, type FileRow } from '@/mocks/data'
import { clone, delay, uid } from '@/mocks/util'

function toFileItem(row: FileRow): FileItem {
  const { office_id: _office, ...rest } = row
  return rest
}

export interface FolderFilter {
  officeId: UUID
  parentId?: UUID | null
}

export interface FileFilter {
  officeId: UUID
  folderId?: UUID | null
  q?: string
}

export const FileApi = {
  async listFolders(filter: FolderFilter): Promise<FolderItem[]> {
    const parent = filter.parentId ?? null
    const result = folders.filter((f) => f.parent_id === parent)
    return delay(clone(result))
  },

  async listFiles(filter: FileFilter): Promise<FileItem[]> {
    const q = (filter.q ?? '').trim().toLowerCase()
    const folderId = filter.folderId ?? null
    const result = files
      .filter((f) => f.office_id === filter.officeId)
      .filter((f) => f.folder_id === folderId)
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .map(toFileItem)
    return delay(clone(result))
  },

  async recent(officeId: UUID, limit = 5): Promise<FileItem[]> {
    const result = files
      .filter((f) => f.office_id === officeId)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(toFileItem)
    return delay(clone(result))
  },

  async breadcrumb(folderId: UUID | null): Promise<FolderItem[]> {
    const trail: FolderItem[] = []
    let current = folderId ? folders.find((f) => f.id === folderId) ?? null : null
    while (current) {
      trail.unshift(current)
      const parentId: UUID | null = current.parent_id
      current = parentId ? folders.find((f) => f.id === parentId) ?? null : null
    }
    return delay(clone(trail))
  },

  async createFolder(officeId: UUID, name: string, parentId: UUID | null): Promise<FolderItem> {
    void officeId
    const folder: FolderItem = { id: uid('fld'), name, parent_id: parentId, department_id: null }
    folders.push(folder)
    return delay(clone(folder))
  },

  async renameFolder(id: UUID, name: string): Promise<FolderItem> {
    const folder = folders.find((f) => f.id === id)
    if (!folder) throw new Error('Папка не найдена')
    folder.name = name
    return delay(clone(folder))
  },

  /** Рекурсивное удаление папки со всем содержимым (как корзина Windows). */
  async deleteFolder(id: UUID): Promise<void> {
    const toRemove = new Set<UUID>()
    const collect = (folderId: UUID): void => {
      toRemove.add(folderId)
      folders.filter((f) => f.parent_id === folderId).forEach((child) => collect(child.id))
    }
    collect(id)
    for (let i = folders.length - 1; i >= 0; i -= 1) {
      const folder = folders[i]
      if (folder && toRemove.has(folder.id)) folders.splice(i, 1)
    }
    for (let i = files.length - 1; i >= 0; i -= 1) {
      const file = files[i]
      if (file && file.folder_id && toRemove.has(file.folder_id)) files.splice(i, 1)
    }
    return delay(undefined)
  },

  async renameFile(id: UUID, name: string): Promise<FileItem> {
    const file = files.find((f) => f.id === id)
    if (!file) throw new Error('Файл не найден')
    file.name = name
    return delay(clone(toFileItem(file)))
  },

  /** Мок-загрузка: создаём метаданные из имени/размера. */
  async create(
    officeId: UUID,
    params: { name: string; size_bytes: number; mime_type: string; folder_id: UUID | null; author_id: UUID; author_name: string; author_color: string },
  ): Promise<FileItem> {
    const row: FileRow = {
      id: uid('file'),
      office_id: officeId,
      name: params.name,
      mime_type: params.mime_type,
      size_bytes: params.size_bytes,
      folder_id: params.folder_id,
      department_id: null,
      department_name: null,
      storage_backend: 'local',
      uploaded_by: params.author_id,
      uploaded_by_name: params.author_name,
      uploaded_by_color: params.author_color,
      created_at: new Date().toISOString(),
    }
    files.unshift(row)
    return delay(clone(toFileItem(row)))
  },

  async importUrl(officeId: UUID, url: string, name: string, folderId: UUID | null, author: { id: UUID; name: string; color: string }): Promise<FileItem> {
    return this.create(officeId, {
      name,
      size_bytes: 120 * 1024,
      mime_type: 'application/octet-stream',
      folder_id: folderId,
      author_id: author.id,
      author_name: author.name,
      author_color: author.color,
    })
  },

  async remove(id: UUID): Promise<void> {
    const idx = files.findIndex((f) => f.id === id)
    if (idx >= 0) files.splice(idx, 1)
    return delay(undefined)
  },
}
