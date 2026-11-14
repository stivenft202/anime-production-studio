/**
 * Helpers del módulo Referencias visuales (fase 4).
 *
 * La galería central son los archivos del proyecto (`db.assets`) más
 * sus enlaces a otros elementos (`db.assetLinks`). Los archivos en sí
 * se guardan y se borran con `src/lib/files.ts` (saveAssetFile /
 * getAssetUrl / deleteAssetFile); aquí nunca se toca el binario y
 * nunca se guarda Base64 en PostgreSQL (el binario no va a la base de
 * datos: en Electron va a disco y en web a blobs de IndexedDB).
 */
import {
  db,
  type Asset,
  type AssetLink,
  type AssetLinkTargetType,
} from '../db/db'
import { deleteAssetFile, getAssetUrl, type AssetRef } from './files'

export type { Asset, AssetLink, AssetLinkTargetType }

/* ------------------------------------------------------------------ */
/* Tipo de archivo                                                     */
/* ------------------------------------------------------------------ */

export type AssetKind = 'imagen' | 'video' | 'audio' | 'documento' | 'otro'

export function assetKind(asset: Pick<Asset, 'mime' | 'name'>): AssetKind {
  const mime = (asset.mime || '').toLowerCase()
  if (mime.startsWith('image/')) return 'imagen'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (
    mime.startsWith('text/') ||
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('opendocument')
  ) {
    return 'documento'
  }
  const ext = asset.name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'imagen'
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio'
  if (['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'].includes(ext)) {
    return 'documento'
  }
  return 'otro'
}

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  imagen: 'Imagen',
  video: 'Vídeo',
  audio: 'Audio',
  documento: 'Documento',
  otro: 'Otro',
}

/** Extensión del archivo (sin punto), en minúsculas; '' si no tiene. */
export function assetExtension(asset: Pick<Asset, 'name'>): string {
  const parts = asset.name.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : ''
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatAssetDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ------------------------------------------------------------------ */
/* Archivos                                                            */
/* ------------------------------------------------------------------ */

export async function listProjectAssets(projectId: string): Promise<Asset[]> {
  return db.assets.where('projectId').equals(projectId).sortBy('createdAt')
}

/**
 * Elimina un archivo del proyecto: borra el binario (disco o blob),
 * el registro del asset y TODOS sus enlaces. Si el asset está enlazado
 * como imagen principal de un personaje, portada de proyecto o imagen
 * de una entrada de lore, esas referencias quedan huérfanas y la
 * interfaz las muestra como "sin imagen" (no se borran otros datos).
 */
export async function deleteAssetWithLinks(asset: Asset): Promise<void> {
  await db.assetLinks.where('assetId').equals(asset.id).delete()
  await deleteAssetFile(asset as unknown as AssetRef)
}

/**
 * Descarga un archivo: resuelve su URL (data: URL en disco, blob URL
 * en web) y dispara la descarga con el nombre original del archivo.
 * Solo se carga el contenido completo cuando el usuario lo pide.
 */
export async function downloadAsset(asset: Asset): Promise<void> {
  const url = await getAssetUrl(asset as unknown as AssetRef)
  const a = document.createElement('a')
  a.href = url
  a.download = asset.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (url.startsWith('blob:')) {
    // Dar tiempo al navegador a iniciar la descarga antes de revocar.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/* ------------------------------------------------------------------ */
/* Enlaces (un mismo archivo enlazado a varios elementos)              */
/* ------------------------------------------------------------------ */

export const ASSET_LINK_TARGET_TYPES: {
  value: AssetLinkTargetType
  label: string
}[] = [
  { value: 'personaje', label: 'Personaje' },
  { value: 'episodio', label: 'Episodio' },
  { value: 'escena', label: 'Escena' },
  { value: 'plano', label: 'Plano' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'lore', label: 'Entrada de lore' },
]

export const ASSET_LINK_TARGET_LABELS: Record<AssetLinkTargetType, string> = {
  personaje: 'Personaje',
  episodio: 'Episodio',
  escena: 'Escena',
  plano: 'Plano',
  lugar: 'Lugar',
  objeto: 'Objeto',
  prompt: 'Prompt',
  lore: 'Entrada de lore',
}

export async function listAssetLinks(assetId: string): Promise<AssetLink[]> {
  return db.assetLinks.where('assetId').equals(assetId).sortBy('createdAt')
}

export async function listLinksForTarget(
  targetType: AssetLinkTargetType,
  targetId: string,
): Promise<AssetLink[]> {
  // Sin índice compuesto en el esquema: se filtra por targetId y tipo.
  return db.assetLinks
    .where('targetId')
    .equals(targetId)
    .filter((l) => l.targetType === targetType)
    .toArray()
}

/**
 * Crea un enlace entre un archivo y un elemento. Si el enlace ya
 * existe, no hace nada (sin duplicados). Devuelve el id del enlace.
 */
export async function createAssetLink(
  projectId: string,
  assetId: string,
  targetType: AssetLinkTargetType,
  targetId: string,
): Promise<string> {
  const existing = await db.assetLinks
    .where('assetId')
    .equals(assetId)
    .filter((l) => l.targetType === targetType && l.targetId === targetId)
    .first()
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await db.assetLinks.add({ id, projectId, assetId, targetType, targetId, createdAt: Date.now() })
  return id
}

export async function deleteAssetLink(linkId: string): Promise<void> {
  await db.assetLinks.delete(linkId)
}

/**
 * Resuelve el nombre visible de un destino de enlace. Devuelve null si
 * el elemento ya no existe (p. ej. fue eliminado): la interfaz lo
 * muestra como "Elemento eliminado".
 */
export async function resolveLinkTargetName(link: AssetLink): Promise<string | null> {
  switch (link.targetType) {
    case 'personaje': {
      const c = await db.characters.get(link.targetId)
      return c ? c.name : null
    }
    case 'episodio': {
      const e = await db.episodes.get(link.targetId)
      return e ? `Episodio ${e.number}${e.title ? ` — ${e.title}` : ''}` : null
    }
    case 'escena': {
      const s = await db.scenes.get(link.targetId)
      if (!s) return null
      const ep = await db.episodes.get(s.episodeId)
      return `Escena ${s.number}${s.title ? ` — ${s.title}` : ''}${ep ? ` (Ep. ${ep.number})` : ''}`
    }
    case 'plano': {
      const sh = await db.shots.get(link.targetId)
      if (!sh) return null
      const scene = await db.scenes.get(sh.sceneId)
      return `Plano ${sh.number}${scene ? ` (Escena ${scene.number})` : ''}`
    }
    case 'prompt': {
      const p = await db.prompts.get(link.targetId)
      return p ? p.name : null
    }
    case 'lore': {
      const l = await db.loreEntries.get(link.targetId)
      return l ? l.title : null
    }
    default:
      return null
  }
}
