/**
 * Helpers del módulo Biblioteca de prompts (fase 4).
 *
 * Los tipos de entidad viven en `src/db/db.ts` (contrato de datos de la
 * fase 4) y aquí se accede a las tablas Dexie directamente, igual que en
 * `src/lib/lore.ts` y `src/lib/characters.ts`.
 */
import { db, type PromptCategory, type PromptEntry, type PromptVariant } from '../db/db'

export type { PromptCategory, PromptEntry, PromptVariant }

/* ------------------------------------------------------------------ */
/* Etiquetas de las categorías                                         */
/* ------------------------------------------------------------------ */

export const PROMPT_CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: 'imagen', label: 'Imagen' },
  { value: 'video', label: 'Vídeo' },
  { value: 'animacion', label: 'Animación' },
  { value: 'voz', label: 'Voz' },
  { value: 'musica', label: 'Música' },
  { value: 'edicion', label: 'Edición' },
  { value: 'escenarios', label: 'Escenarios' },
  { value: 'personajes', label: 'Personajes' },
  { value: 'expresiones', label: 'Expresiones' },
  { value: 'movimiento-camara', label: 'Movimiento de cámara' },
  { value: 'otros', label: 'Otros' },
]

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  imagen: 'Imagen',
  video: 'Vídeo',
  animacion: 'Animación',
  voz: 'Voz',
  musica: 'Música',
  edicion: 'Edición',
  escenarios: 'Escenarios',
  personajes: 'Personajes',
  expresiones: 'Expresiones',
  'movimiento-camara': 'Movimiento de cámara',
  otros: 'Otros',
}

/** Tipos de generación habituales (texto libre en el formulario). */
export const GENERATION_TYPES = ['imagen', 'vídeo', 'animación', 'voz', 'música', 'edición']

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}

/** Campos editables de un prompt (sin id ni metadatos). */
export type PromptEntryInput = Omit<PromptEntry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>

/** Campos editables de una variante de prompt. */
export type PromptVariantInput = Omit<
  PromptVariant,
  'id' | 'projectId' | 'promptId' | 'createdAt' | 'updatedAt'
>

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export async function listPrompts(projectId: string): Promise<PromptEntry[]> {
  return db.prompts.where('projectId').equals(projectId).sortBy('createdAt')
}

export async function createPrompt(
  projectId: string,
  input: PromptEntryInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  await db.prompts.add({ ...input, id, projectId, createdAt: timestamp, updatedAt: timestamp })
  return id
}

export async function updatePrompt(
  promptId: string,
  input: Partial<PromptEntryInput>,
): Promise<void> {
  await db.prompts.update(promptId, { ...input, updatedAt: now() })
}

export async function deletePrompt(promptId: string): Promise<void> {
  // Las variantes pertenecen al prompt: se borran con él.
  await db.transaction('rw', db.prompts, db.promptVariants, async () => {
    await db.promptVariants.where('promptId').equals(promptId).delete()
    await db.prompts.delete(promptId)
  })
}

/**
 * Duplica un prompt. Las imágenes de referencia y el resultado generado
 * se reutilizan (mismos assetIds); las variantes NO se copian (cada
 * variante pertenece a su prompt original). Devuelve el id del nuevo.
 */
export async function duplicatePrompt(promptId: string): Promise<string> {
  const original = await db.prompts.get(promptId)
  if (!original) throw new Error('Prompt no encontrado')
  const timestamp = now()
  const copy: PromptEntry = {
    ...original,
    id: newId(),
    name: `${original.name} (copia)`,
    isFavorite: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.prompts.add(copy)
  return copy.id
}

export async function togglePromptFavorite(promptId: string): Promise<void> {
  const prompt = await db.prompts.get(promptId)
  if (!prompt) return
  await db.prompts.update(promptId, { isFavorite: !prompt.isFavorite, updatedAt: now() })
}

/* ------------------------------------------------------------------ */
/* Variantes                                                           */
/* ------------------------------------------------------------------ */

export async function listPromptVariants(promptId: string): Promise<PromptVariant[]> {
  return db.promptVariants.where('promptId').equals(promptId).sortBy('createdAt')
}

export async function createPromptVariant(
  projectId: string,
  promptId: string,
  input: PromptVariantInput,
): Promise<string> {
  const timestamp = now()
  const id = newId()
  await db.promptVariants.add({
    ...input,
    id,
    projectId,
    promptId,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return id
}

export async function updatePromptVariant(
  variantId: string,
  input: Partial<PromptVariantInput>,
): Promise<void> {
  await db.promptVariants.update(variantId, { ...input, updatedAt: now() })
}

export async function deletePromptVariant(variantId: string): Promise<void> {
  await db.promptVariants.delete(variantId)
}

/* ------------------------------------------------------------------ */
/* Portapapeles (con fallback para cuando la API no está disponible)   */
/* ------------------------------------------------------------------ */

/**
 * Copia texto al portapapeles. Usa `navigator.clipboard` cuando está
 * disponible (contexto seguro) y un `<textarea>` temporal + `execCommand`
 * como fallback. Devuelve true si se copió.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Cae al fallback de abajo.
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
