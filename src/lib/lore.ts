/**
 * Helpers del módulo de Universo y lore (fase 2).
 *
 * Los tipos de entidad viven en `src/db/db.ts` (contrato de datos de la
 * fase 2) y aquí se accede a las tablas Dexie por nombre, igual que en
 * `src/lib/characters.ts`.
 */
import type Dexie from 'dexie'
import type { LoreEntry, LoreEntryType, TimelineEvent } from '../db/db'

export type { LoreEntry, LoreEntryType, TimelineEvent }

/* ------------------------------------------------------------------ */
/* Etiquetas de los tipos de entrada                                   */
/* ------------------------------------------------------------------ */

export const LORE_ENTRY_TYPES: { value: LoreEntryType; label: string }[] = [
  { value: 'historia-mundo', label: 'Historia del mundo' },
  { value: 'reglas', label: 'Reglas' },
  { value: 'faccion', label: 'Facción' },
  { value: 'organizacion', label: 'Organización' },
  { value: 'especie', label: 'Especie' },
  { value: 'criatura', label: 'Criatura' },
  { value: 'sistema-poder', label: 'Sistema de poder' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'religion', label: 'Religión' },
  { value: 'leyenda', label: 'Leyenda' },
  { value: 'acontecimiento', label: 'Acontecimiento' },
  { value: 'misterio', label: 'Misterio' },
  { value: 'concepto', label: 'Concepto' },
]

export const LORE_ENTRY_TYPE_LABELS: Record<LoreEntryType, string> = {
  'historia-mundo': 'Historia del mundo',
  reglas: 'Reglas',
  faccion: 'Facción',
  organizacion: 'Organización',
  especie: 'Especie',
  criatura: 'Criatura',
  'sistema-poder': 'Sistema de poder',
  tecnologia: 'Tecnología',
  religion: 'Religión',
  leyenda: 'Leyenda',
  acontecimiento: 'Acontecimiento',
  misterio: 'Misterio',
  concepto: 'Concepto',
}

/** Números de episodio disponibles para vincular entradas de lore (rango genérico 1-12). */
export const EPISODE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/* ------------------------------------------------------------------ */
/* Acceso a tablas                                                     */
/* ------------------------------------------------------------------ */

export function loreTables(db: Dexie) {
  return {
    loreEntries: db.table<LoreEntry, string>('loreEntries'),
    timelineEvents: db.table<TimelineEvent, string>('timelineEvents'),
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}

/** Campos editables de una entrada de lore (sin id ni metadatos). */
export type LoreEntryInput = Omit<
  LoreEntry,
  'id' | 'projectId' | 'orderIndex' | 'createdAt' | 'updatedAt'
>

/** Campos editables de un acontecimiento de la cronología. */
export type TimelineEventInput = Omit<
  TimelineEvent,
  'id' | 'projectId' | 'orderIndex' | 'createdAt' | 'updatedAt'
>

/* ------------------------------------------------------------------ */
/* Entradas de lore                                                    */
/* ------------------------------------------------------------------ */

export async function listLoreEntries(db: Dexie, projectId: string): Promise<LoreEntry[]> {
  return loreTables(db)
    .loreEntries.where('projectId')
    .equals(projectId)
    .sortBy('title')
}

export async function createLoreEntry(
  db: Dexie,
  projectId: string,
  input: LoreEntryInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  const orderIndex = await loreTables(db)
    .loreEntries.where('projectId')
    .equals(projectId)
    .count()
  await loreTables(db).loreEntries.add({
    ...input,
    id,
    projectId,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateLoreEntry(
  db: Dexie,
  entryId: string,
  input: Partial<LoreEntryInput>,
): Promise<void> {
  await loreTables(db).loreEntries.update(entryId, { ...input, updatedAt: now() })
}

export async function deleteLoreEntry(db: Dexie, entryId: string): Promise<void> {
  await loreTables(db).loreEntries.delete(entryId)
}

/**
 * Duplica una entrada de lore. Las imágenes se reutilizan (mismos
 * assetIds); las relaciones con personajes, lugares y episodios se copian.
 * Devuelve el id de la entrada nueva.
 */
export async function duplicateLoreEntry(db: Dexie, entryId: string): Promise<string> {
  const original = await loreTables(db).loreEntries.get(entryId)
  if (!original) throw new Error('Entrada de lore no encontrada')
  const timestamp = now()
  const orderIndex = await loreTables(db)
    .loreEntries.where('projectId')
    .equals(original.projectId)
    .count()
  const copy: LoreEntry = {
    ...original,
    id: newId(),
    title: `${original.title} (copia)`,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await loreTables(db).loreEntries.add(copy)
  return copy.id
}

/* ------------------------------------------------------------------ */
/* Cronología                                                          */
/* ------------------------------------------------------------------ */

export async function listTimelineEvents(
  db: Dexie,
  projectId: string,
): Promise<TimelineEvent[]> {
  return loreTables(db)
    .timelineEvents.where('projectId')
    .equals(projectId)
    .sortBy('orderIndex')
}

export async function createTimelineEvent(
  db: Dexie,
  projectId: string,
  input: TimelineEventInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  const orderIndex = await loreTables(db)
    .timelineEvents.where('projectId')
    .equals(projectId)
    .count()
  await loreTables(db).timelineEvents.add({
    ...input,
    id,
    projectId,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updateTimelineEvent(
  db: Dexie,
  eventId: string,
  input: Partial<TimelineEventInput>,
): Promise<void> {
  await loreTables(db).timelineEvents.update(eventId, { ...input, updatedAt: now() })
}

export async function deleteTimelineEvent(db: Dexie, eventId: string): Promise<void> {
  await loreTables(db).timelineEvents.delete(eventId)
}

/**
 * Duplica un acontecimiento y lo coloca al final de la cronología.
 * Devuelve el id del acontecimiento nuevo.
 */
export async function duplicateTimelineEvent(db: Dexie, eventId: string): Promise<string> {
  const original = await loreTables(db).timelineEvents.get(eventId)
  if (!original) throw new Error('Acontecimiento no encontrado')
  const timestamp = now()
  const orderIndex = await loreTables(db)
    .timelineEvents.where('projectId')
    .equals(original.projectId)
    .count()
  const copy: TimelineEvent = {
    ...original,
    id: newId(),
    title: `${original.title} (copia)`,
    orderIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await loreTables(db).timelineEvents.add(copy)
  return copy.id
}

/**
 * Mueve un acontecimiento una posición arriba (direction = -1) o abajo
 * (direction = +1) dentro de la cronología, intercambiando su orderIndex
 * con el vecino. No hace nada si ya está en el extremo.
 */
export async function moveTimelineEvent(
  db: Dexie,
  eventId: string,
  direction: -1 | 1,
): Promise<void> {
  const t = loreTables(db)
  const event = await t.timelineEvents.get(eventId)
  if (!event) return
  const siblings = await t.timelineEvents
    .where('projectId')
    .equals(event.projectId)
    .sortBy('orderIndex')
  const index = siblings.findIndex((e) => e.id === eventId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
  const neighbour = siblings[targetIndex]
  await db.transaction('rw', t.timelineEvents, async () => {
    await t.timelineEvents.update(eventId, { orderIndex: neighbour.orderIndex })
    await t.timelineEvents.update(neighbour.id, { orderIndex: event.orderIndex })
  })
}
