/**
 * Helpers del módulo de Guiones y episodios (fase 3).
 *
 * Los tipos de entidad viven en `src/db/db.ts` (versión 3: episodes,
 * scenes, shots, dialogueLines) y aquí se accede a las tablas Dexie por
 * nombre, igual que en `src/lib/lore.ts` y `src/lib/characters.ts`.
 */
import type Dexie from 'dexie'
import type {
  DialogueLine,
  Episode,
  EpisodeStatus,
  Scene,
  Shot,
  ShotResultStatus,
} from '../db/db'

export type { DialogueLine, Episode, EpisodeStatus, Scene, Shot, ShotResultStatus }

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

export const EPISODE_STATUSES: { value: EpisodeStatus; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'en-escritura', label: 'En escritura' },
  { value: 'terminado', label: 'Terminado' },
  { value: 'publicado', label: 'Publicado' },
]

export const EPISODE_STATUS_LABELS: Record<EpisodeStatus, string> = {
  borrador: 'Borrador',
  'en-escritura': 'En escritura',
  terminado: 'Terminado',
  publicado: 'Publicado',
}

export const SHOT_RESULT_STATUSES: { value: ShotResultStatus; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'en-progreso', label: 'En progreso' },
  { value: 'terminado', label: 'Terminado' },
  { value: 'descartado', label: 'Descartado' },
]

export const SHOT_RESULT_STATUS_LABELS: Record<ShotResultStatus, string> = {
  borrador: 'Borrador',
  'en-progreso': 'En progreso',
  terminado: 'Terminado',
  descartado: 'Descartado',
}

/** "Episodio 3 — Título" o "Episodio 3 (sin título)" cuando no hay título. */
export function episodeLabel(episode: Pick<Episode, 'number' | 'title'>): string {
  const title = episode.title.trim()
  return title ? `Episodio ${episode.number} — ${title}` : `Episodio ${episode.number} (sin título)`
}

/** Duración en segundos → "1 h 5 min", "12 min", "45 s" o "—" si no hay dato. */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || seconds <= 0) return '—'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  if (minutes > 0) return secs > 0 ? `${minutes} min ${secs} s` : `${minutes} min`
  return `${secs} s`
}

/* ------------------------------------------------------------------ */
/* Acceso a tablas                                                     */
/* ------------------------------------------------------------------ */

export function scriptTables(db: Dexie) {
  return {
    episodes: db.table<Episode, string>('episodes'),
    scenes: db.table<Scene, string>('scenes'),
    shots: db.table<Shot, string>('shots'),
    dialogueLines: db.table<DialogueLine, string>('dialogueLines'),
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}

/** Campos editables de un episodio (sin id ni metadatos). */
export type EpisodeInput = Omit<Episode, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>

/** Campos editables de una escena. */
export type SceneInput = Omit<Scene, 'id' | 'projectId' | 'episodeId' | 'orderIndex' | 'createdAt' | 'updatedAt'>

/** Campos editables de un plano. */
export type ShotInput = Omit<Shot, 'id' | 'projectId' | 'sceneId' | 'orderIndex' | 'createdAt' | 'updatedAt'>

/** Campos editables de una línea de diálogo. */
export type DialogueLineInput = Omit<DialogueLine, 'id' | 'projectId' | 'episodeId' | 'orderIndex' | 'createdAt' | 'updatedAt'>

/* ------------------------------------------------------------------ */
/* Episodios                                                           */
/* ------------------------------------------------------------------ */

export async function listEpisodes(db: Dexie, projectId: string): Promise<Episode[]> {
  return scriptTables(db).episodes.where('projectId').equals(projectId).sortBy('number')
}

export async function getEpisode(db: Dexie, episodeId: string): Promise<Episode | undefined> {
  return scriptTables(db).episodes.get(episodeId)
}

/** Siguiente número de episodio libre dentro del proyecto. */
export async function nextEpisodeNumber(db: Dexie, projectId: string): Promise<number> {
  const episodes = await listEpisodes(db, projectId)
  return episodes.reduce((max, e) => Math.max(max, e.number), 0) + 1
}

export async function createEpisode(
  db: Dexie,
  projectId: string,
  input: EpisodeInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  await scriptTables(db).episodes.add({
    ...input,
    id,
    projectId,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateEpisode(
  db: Dexie,
  episodeId: string,
  input: Partial<EpisodeInput>,
): Promise<void> {
  await scriptTables(db).episodes.update(episodeId, { ...input, updatedAt: now() })
}

/**
 * Elimina un episodio con todas sus escenas, planos y líneas de diálogo.
 */
export async function deleteEpisodeCascade(db: Dexie, episodeId: string): Promise<void> {
  const t = scriptTables(db)
  const scenes = await t.scenes.where('episodeId').equals(episodeId).toArray()
  const sceneIds = scenes.map((s) => s.id)
  const shots = await t.shots
    .where('sceneId')
    .anyOf(sceneIds)
    .toArray()
    .catch(() => [] as Shot[])
  const shotIds = shots.map((s) => s.id)
  await db.transaction('rw', t.episodes, t.scenes, t.shots, t.dialogueLines, async () => {
    if (shotIds.length > 0) {
      await t.dialogueLines.where('shotId').anyOf(shotIds).delete()
    }
    await t.dialogueLines.where('episodeId').equals(episodeId).delete()
    if (sceneIds.length > 0) await t.shots.where('sceneId').anyOf(sceneIds).delete()
    await t.scenes.where('episodeId').equals(episodeId).delete()
    await t.episodes.delete(episodeId)
  })
}

/**
 * Duplica un episodio con sus escenas, planos y diálogos (nuevos IDs).
 * El guion (scriptJson/scriptText) se copia tal cual. Devuelve el id nuevo.
 */
export async function duplicateEpisode(db: Dexie, episodeId: string): Promise<string> {
  const t = scriptTables(db)
  const original = await t.episodes.get(episodeId)
  if (!original) throw new Error('Episodio no encontrado')
  const timestamp = now()
  const newEpisodeId = newId()
  const copy: Episode = {
    ...original,
    id: newEpisodeId,
    number: await nextEpisodeNumber(db, original.projectId),
    title: original.title ? `${original.title} (copia)` : '',
    status: 'borrador',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await t.episodes.add(copy)

  const scenes = await t.scenes.where('episodeId').equals(episodeId).sortBy('orderIndex')
  const sceneIdMap = new Map<string, string>()
  for (const scene of scenes) {
    const newSceneId = newId()
    sceneIdMap.set(scene.id, newSceneId)
    await t.scenes.add({ ...scene, id: newSceneId, episodeId: newEpisodeId, createdAt: timestamp, updatedAt: timestamp })
  }
  const shots = await t.shots
    .where('sceneId')
    .anyOf(scenes.map((s) => s.id))
    .sortBy('orderIndex')
  const shotIdMap = new Map<string, string>()
  for (const shot of shots) {
    const newShotId = newId()
    shotIdMap.set(shot.id, newShotId)
    const newSceneId = sceneIdMap.get(shot.sceneId)
    if (!newSceneId) continue
    await t.shots.add({ ...shot, id: newShotId, sceneId: newSceneId, createdAt: timestamp, updatedAt: timestamp })
  }
  const lines = await t.dialogueLines.where('episodeId').equals(episodeId).sortBy('orderIndex')
  for (const line of lines) {
    await t.dialogueLines.add({
      ...line,
      id: newId(),
      episodeId: newEpisodeId,
      sceneId: line.sceneId ? (sceneIdMap.get(line.sceneId) ?? undefined) : undefined,
      shotId: line.shotId ? (shotIdMap.get(line.shotId) ?? undefined) : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
  return newEpisodeId
}

/* ------------------------------------------------------------------ */
/* Escenas                                                             */
/* ------------------------------------------------------------------ */

export async function listScenes(db: Dexie, episodeId: string): Promise<Scene[]> {
  return scriptTables(db).scenes.where('episodeId').equals(episodeId).sortBy('orderIndex')
}

export async function nextSceneNumber(db: Dexie, episodeId: string): Promise<number> {
  const scenes = await listScenes(db, episodeId)
  return scenes.reduce((max, s) => Math.max(max, s.number), 0) + 1
}

export async function createScene(
  db: Dexie,
  projectId: string,
  episodeId: string,
  input: SceneInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  const orderIndex = await scriptTables(db).scenes.where('episodeId').equals(episodeId).count()
  await scriptTables(db).scenes.add({
    ...input,
    id,
    projectId,
    episodeId,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateScene(
  db: Dexie,
  sceneId: string,
  input: Partial<SceneInput>,
): Promise<void> {
  await scriptTables(db).scenes.update(sceneId, { ...input, updatedAt: now() })
}

/** Elimina una escena con sus planos y sus líneas de diálogo. */
export async function deleteSceneCascade(db: Dexie, sceneId: string): Promise<void> {
  const t = scriptTables(db)
  const shots = await t.shots.where('sceneId').equals(sceneId).toArray()
  const shotIds = shots.map((s) => s.id)
  await db.transaction('rw', t.scenes, t.shots, t.dialogueLines, async () => {
    if (shotIds.length > 0) {
      await t.dialogueLines.where('shotId').anyOf(shotIds).delete()
    }
    await t.dialogueLines.where('sceneId').equals(sceneId).delete()
    await t.shots.where('sceneId').equals(sceneId).delete()
    await t.scenes.delete(sceneId)
  })
}

/**
 * Mueve una escena una posición arriba (direction = -1) o abajo (+1)
 * dentro de su episodio, intercambiando su orderIndex con la vecina.
 */
export async function moveScene(db: Dexie, sceneId: string, direction: -1 | 1): Promise<void> {
  const t = scriptTables(db)
  const scene = await t.scenes.get(sceneId)
  if (!scene) return
  const siblings = await t.scenes.where('episodeId').equals(scene.episodeId).sortBy('orderIndex')
  const index = siblings.findIndex((s) => s.id === sceneId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
  const neighbour = siblings[targetIndex]
  await db.transaction('rw', t.scenes, async () => {
    await t.scenes.update(sceneId, { orderIndex: neighbour.orderIndex })
    await t.scenes.update(neighbour.id, { orderIndex: scene.orderIndex })
  })
}

/* ------------------------------------------------------------------ */
/* Planos                                                              */
/* ------------------------------------------------------------------ */

export async function listShots(db: Dexie, sceneId: string): Promise<Shot[]> {
  return scriptTables(db).shots.where('sceneId').equals(sceneId).sortBy('orderIndex')
}

export async function nextShotNumber(db: Dexie, sceneId: string): Promise<number> {
  const shots = await listShots(db, sceneId)
  return shots.reduce((max, s) => Math.max(max, s.number), 0) + 1
}

export async function createShot(
  db: Dexie,
  projectId: string,
  sceneId: string,
  input: ShotInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  const orderIndex = await scriptTables(db).shots.where('sceneId').equals(sceneId).count()
  await scriptTables(db).shots.add({
    ...input,
    id,
    projectId,
    sceneId,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateShot(
  db: Dexie,
  shotId: string,
  input: Partial<ShotInput>,
): Promise<void> {
  await scriptTables(db).shots.update(shotId, { ...input, updatedAt: now() })
}

export async function deleteShot(db: Dexie, shotId: string): Promise<void> {
  const t = scriptTables(db)
  await db.transaction('rw', t.shots, t.dialogueLines, async () => {
    await t.dialogueLines.where('shotId').equals(shotId).delete()
    await t.shots.delete(shotId)
  })
}

export async function moveShot(db: Dexie, shotId: string, direction: -1 | 1): Promise<void> {
  const t = scriptTables(db)
  const shot = await t.shots.get(shotId)
  if (!shot) return
  const siblings = await t.shots.where('sceneId').equals(shot.sceneId).sortBy('orderIndex')
  const index = siblings.findIndex((s) => s.id === shotId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
  const neighbour = siblings[targetIndex]
  await db.transaction('rw', t.shots, async () => {
    await t.shots.update(shotId, { orderIndex: neighbour.orderIndex })
    await t.shots.update(neighbour.id, { orderIndex: shot.orderIndex })
  })
}

/* ------------------------------------------------------------------ */
/* Diálogos                                                            */
/* ------------------------------------------------------------------ */

export async function listDialogueLines(db: Dexie, episodeId: string): Promise<DialogueLine[]> {
  return scriptTables(db).dialogueLines.where('episodeId').equals(episodeId).sortBy('orderIndex')
}

export async function listDialogueLinesForScene(
  db: Dexie,
  sceneId: string,
): Promise<DialogueLine[]> {
  return scriptTables(db).dialogueLines.where('sceneId').equals(sceneId).sortBy('orderIndex')
}

export async function createDialogueLine(
  db: Dexie,
  projectId: string,
  episodeId: string,
  input: DialogueLineInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  const orderIndex = await scriptTables(db)
    .dialogueLines.where('episodeId')
    .equals(episodeId)
    .count()
  await scriptTables(db).dialogueLines.add({
    ...input,
    id,
    projectId,
    episodeId,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateDialogueLine(
  db: Dexie,
  lineId: string,
  input: Partial<DialogueLineInput>,
): Promise<void> {
  await scriptTables(db).dialogueLines.update(lineId, { ...input, updatedAt: now() })
}

export async function deleteDialogueLine(db: Dexie, lineId: string): Promise<void> {
  await scriptTables(db).dialogueLines.delete(lineId)
}

/**
 * Mueve una línea de diálogo una posición arriba (-1) o abajo (+1)
 * dentro de su grupo: mismo episodio y misma escena (las líneas sin
 * escena forman su propio grupo).
 */
export async function moveDialogueLine(
  db: Dexie,
  lineId: string,
  direction: -1 | 1,
): Promise<void> {
  const t = scriptTables(db)
  const line = await t.dialogueLines.get(lineId)
  if (!line) return
  const all = await t.dialogueLines.where('episodeId').equals(line.episodeId).sortBy('orderIndex')
  const siblings = all.filter((l) => (l.sceneId ?? null) === (line.sceneId ?? null))
  const index = siblings.findIndex((l) => l.id === lineId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
  const neighbour = siblings[targetIndex]
  await db.transaction('rw', t.dialogueLines, async () => {
    await t.dialogueLines.update(lineId, { orderIndex: neighbour.orderIndex })
    await t.dialogueLines.update(neighbour.id, { orderIndex: line.orderIndex })
  })
}
