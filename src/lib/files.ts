import { db, type Asset } from '../db/db'

export type AssetRef = {
  id: string
  name: string
  mime: string
  size: number
  storage: 'indexeddb' | 'disk'
  path?: string
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'
}

/** La API completa de Electron (declarada en src/vite-env.d.ts). */
export function getElectronAPIFull(): ElectronAPIFull | undefined {
  if (typeof window === 'undefined') return undefined
  return window.electronAPI
}

export async function saveAssetFile(file: File, projectId: string): Promise<AssetRef> {
  const api = getElectronAPIFull()
  if (isElectron() && api) {
    const buffer = await file.arrayBuffer()
    const result = await api.saveFile({ name: file.name, buffer, projectId })
    const asset: Asset = {
      id: result.id,
      projectId,
      name: file.name,
      mime: file.type,
      size: file.size,
      storage: 'disk',
      path: result.path,
      createdAt: Date.now(),
    }
    await db.assets.add(asset)
    return { id: asset.id, name: asset.name, mime: asset.mime, size: asset.size, storage: 'disk', path: asset.path }
  }

  // Vista previa web: el blob queda en IndexedDB.
  const id = crypto.randomUUID()
  await db.assetBlobs.add({ id, blob: file })
  const asset: Asset = {
    id,
    projectId,
    name: file.name,
    mime: file.type,
    size: file.size,
    storage: 'indexeddb',
    blobId: id,
    createdAt: Date.now(),
  }
  await db.assets.add(asset)
  return { id, name: file.name, mime: file.type, size: file.size, storage: 'indexeddb' }
}

export async function getAssetUrl(ref: AssetRef): Promise<string> {
  if (ref.storage === 'disk' && ref.path) {
    const api = getElectronAPIFull()
    if (isElectron() && api) {
      const base64 = await api.readFile({ path: ref.path })
      return `data:${ref.mime};base64,${base64}`
    }
    return `file://${ref.path}`
  }
  const record = await db.assetBlobs.get(ref.id)
  if (!record) throw new Error('Archivo no encontrado en el almacenamiento local.')
  return URL.createObjectURL(record.blob)
}

export async function deleteAssetFile(ref: AssetRef): Promise<void> {
  const api = getElectronAPIFull()
  if (ref.storage === 'disk' && ref.path && isElectron() && api) {
    await api.deleteFile({ path: ref.path })
  }
  if (ref.storage === 'indexeddb') {
    await db.assetBlobs.delete(ref.id)
  }
  await db.assets.delete(ref.id)
}
