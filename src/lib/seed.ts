import { db, type Character, type CharacterImage, type CharacterImageCategory } from '../db/db'
import { saveAssetFile } from './files'
import { seedCharacters, type SeedCharacter } from './seedCharacters'
import { seedLoreEntries, seedTimelineEvents } from './seedLore'
import { seedEpisodesIfNeeded } from './seedScripts'
import { seedPromptsIfNeeded } from './seedPrompts'

/**
 * Siembra DEMO (copia pública): un único «Proyecto de ejemplo» con
 * datos INVENTADOS para probar la aplicación (5 personajes, 4 entradas
 * de lore + 3 acontecimientos, 3 episodios con 3 escenas, 1 prompt).
 * Sin imágenes reales: retratos placeholder en `public/demo/`
 * (fondo de color plano + inicial) y portada demo.
 *
 * SEGURIDAD — la siembra demo NUNCA toca datos existentes:
 * - Solo corre cuando la base de datos está VACÍA
 *   (`db.projects.count() === 0`). Si ya hay proyectos, no escribe
 *   nada, no busca ningún proyecto por nombre y no marca ningún flag.
 * - Usa UNA sola clave de flag nueva, `seed_demo_v1`, y solo se marca
 *   al final, cuando TODA la siembra escribió correctamente. Nunca se
 *   marca un flag cuando la función no escribió nada. Las claves de
 *   flag de la siembra original (lore, bios, episodios y prompts) no
 *   se reutilizan jamás: un build demo nunca debe marcarlas.
 * - Las sub-funciones reciben el ID del proyecto demo y el mapa de
 *   personajes demo directamente: no hay búsquedas por nombre.
 * - No existe ninguna corrección de biografías: el demo no tiene
 *   bios que corregir (la función antigua que las corregía se eliminó).
 *
 * La promesa compartida evita sembrar dos veces si dos efectos de React
 * (p. ej. StrictMode en desarrollo) llaman a seedIfEmpty a la vez: sin
 * ella, ambas llamadas verían 0 proyectos y duplicarían los datos.
 */
let seedPromise: Promise<void> | null = null

/** Datos DEMO del proyecto de ejemplo (inventados, no reales). */
export const DEMO_PROJECT_NAME = 'Proyecto de ejemplo'
export const DEMO_PROJECT_GENRE = 'Aventura / Fantasía'
export const DEMO_PROJECT_DESCRIPTION =
  'Proyecto de ejemplo con datos inventados para probar la aplicación.'
export const DEMO_PROJECT_SYNOPSIS =
  'Datos de ejemplo: una cartógrafa, un herrero y una aprendiz parten ' +
  'de Puerto Bruma para completar el primer mapa del Valle del Eco. ' +
  'Todo el contenido de este proyecto es inventado y sirve solo para ' +
  'probar las funciones de la aplicación; puedes editarlo o borrarlo.'
export const DEMO_PROJECT_TAGS = ['ejemplo', 'demo', 'aventura', 'fantasía']

/** Única clave de flag de la siembra demo en `db.settings`. */
const SEED_DEMO_FLAG = 'seed_demo_v1'

const IMAGE_CATEGORIES: CharacterImageCategory[] = [
  'rostro',
  'cuerpo',
  'vestimenta',
  'expresiones',
  'poses',
  'alternativos',
  'otro',
]

function toImageCategory(value: string): CharacterImageCategory {
  return (IMAGE_CATEGORIES as string[]).includes(value)
    ? (value as CharacterImageCategory)
    : 'otro'
}

export function seedIfEmpty(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runDemoSeed()
  }
  return seedPromise
}

/**
 * Orquesta la siembra demo completa bajo una sola guarda: base de
 * datos vacía. Si ya hay proyectos, sale sin escribir nada y sin
 * marcar el flag. El flag `seed_demo_v1` solo se marca al final, si
 * toda la siembra escribió correctamente.
 */
async function runDemoSeed(): Promise<void> {
  const flag = await db.settings.get(SEED_DEMO_FLAG)
  if (flag) return

  if ((await db.projects.count()) > 0) return

  const seeded = await doSeed()
  if (!seeded) return

  await seedLoreIfNeeded(seeded.projectId, seeded.nameToId)
  await seedEpisodesIfNeeded(seeded.projectId, seeded.nameToId)
  await seedPromptsIfNeeded(seeded.projectId, seeded.nameToId)

  await db.settings.put({ key: SEED_DEMO_FLAG, value: String(Date.now()) })
}

/** Resultado de `doSeed`: el proyecto demo creado y sus personajes por nombre. */
type SeededDemo = {
  projectId: string
  nameToId: Map<string, string>
}

/**
 * Crea el proyecto demo y sus personajes. Solo se llama desde
 * `runDemoSeed()` cuando la base de datos está vacía; si ya hay
 * proyectos, devuelve null sin escribir nada.
 */
async function doSeed(): Promise<SeededDemo | null> {
  const existing = await db.projects.count()
  if (existing > 0) return null

  const now = Date.now()

  const demoProjectId = crypto.randomUUID()
  await db.projects.add({
    id: demoProjectId,
    name: DEMO_PROJECT_NAME,
    description: DEMO_PROJECT_DESCRIPTION,
    genre: DEMO_PROJECT_GENRE,
    synopsis: DEMO_PROJECT_SYNOPSIS,
    status: 'en-produccion',
    createdAt: now,
    updatedAt: now,
    language: 'español',
    tags: DEMO_PROJECT_TAGS,
    team: [],
    socialLinks: [],
  })

  // Portada del proyecto: la portada demo (public/demo/portada-demo.png).
  try {
    const posterResponse = await fetch('/demo/portada-demo.png')
    if (posterResponse.ok) {
      const posterBlob = await posterResponse.blob()
      const posterFile = new File([posterBlob], 'portada-demo.png', { type: posterBlob.type || 'image/png' })
      const posterRef = await saveAssetFile(posterFile, demoProjectId)
      await db.projects.update(demoProjectId, { coverAssetId: posterRef.id })
    }
  } catch {
    // Sin portada: el proyecto queda sin portada.
  }

  const nameToId = new Map<string, string>()
  for (const seed of seedCharacters) {
    const id = await insertSeedCharacter(seed, demoProjectId, now)
    nameToId.set(seed.name, id)
  }

  return { projectId: demoProjectId, nameToId }
}

/**
 * Inserta un personaje semilla en un proyecto, con su retrato como
 * imagen principal y sus imágenes adicionales de galería. Si el
 * personaje no tiene retrato (`imageFile` vacío), se crea sin imagen.
 * Devuelve el ID del personaje creado.
 */
async function insertSeedCharacter(
  seed: SeedCharacter,
  projectId: string,
  now: number,
): Promise<string> {
  const characterId = crypto.randomUUID()
  const character: Character = {
    id: characterId,
    projectId,
    name: seed.name,
    internalId: seed.internalId,
    age: seed.age,
    species: seed.species,
    occupation: seed.occupation,
    role: seed.role,
    description: seed.description,
    personality: seed.personality,
    biography: seed.biography,
    hair: seed.hair,
    hairColor: seed.hairColor,
    eyes: seed.eyes,
    eyeColorHex: seed.eyeColorHex,
    height: seed.height,
    build: seed.build,
    skin: seed.skin,
    distinctiveFeatures: seed.distinctiveFeatures,
    clothing: seed.clothing,
    voiceLanguage: seed.voiceLanguage,
    voiceTone: seed.voiceTone,
    vocalAge: seed.vocalAge,
    accent: seed.accent,
    performanceNotes: seed.performanceNotes,
    createdAt: now,
    updatedAt: now,
  }
  await db.characters.add(character)

  // Retrato como imagen principal (categoría "cuerpo").
  if (seed.imageFile) {
    try {
      const response = await fetch(`/demo/${seed.imageFile}`)
      if (!response.ok) throw new Error(`Imagen no disponible: ${seed.imageFile}`)
      const blob = await response.blob()
      const file = new File([blob], seed.imageFile, { type: blob.type || 'image/png' })
      const ref = await saveAssetFile(file, projectId)
      const imageId = crypto.randomUUID()
      const image: CharacterImage = {
        id: imageId,
        characterId,
        assetId: ref.id,
        category: 'cuerpo',
        isMain: true,
        sortOrder: 0,
      }
      await db.characterImages.add(image)
      await db.characters.update(characterId, { mainImageId: imageId })
    } catch {
      // Sin retrato: el personaje queda sin imagen principal.
    }
  }

  // Imágenes adicionales de galería.
  for (const [index, extra] of (seed.extraImages ?? []).entries()) {
    try {
      const extraResponse = await fetch(`/demo/${extra.file}`)
      if (!extraResponse.ok) continue
      const extraBlob = await extraResponse.blob()
      const extraFile = new File([extraBlob], extra.file, { type: extraBlob.type || 'image/png' })
      const extraRef = await saveAssetFile(extraFile, projectId)
      await db.characterImages.add({
        id: crypto.randomUUID(),
        characterId,
        assetId: extraRef.id,
        category: toImageCategory(extra.category),
        isMain: false,
        sortOrder: index + 1,
      })
    } catch {
      // Sin imagen adicional: se ignora y se sigue.
    }
  }

  return characterId
}

/** Resuelve nombres de personaje a IDs; los nombres sin personaje se descartan. */
function resolveCharacterNames(
  names: string[],
  nameToId: Map<string, string>,
): string[] {
  const ids: string[] = []
  for (const name of names) {
    const id = nameToId.get(name)
    if (id) ids.push(id)
  }
  return ids
}

/**
 * Siembra las entradas de lore y los acontecimientos de cronología
 * demo en el proyecto demo (solo si aún no tiene ninguno). No marca
 * ningún flag: el único flag demo lo marca `runDemoSeed()` al final.
 */
export async function seedLoreIfNeeded(
  projectId: string,
  nameToId: Map<string, string>,
): Promise<void> {
  const now = Date.now()
  const { loreEntries, timelineEvents } = db

  const existingEntries = await loreEntries
    .filter((entry) => entry.projectId === projectId)
    .count()
  if (existingEntries === 0) {
    await loreEntries.bulkAdd(
      seedLoreEntries.map(({ characterNames, ...entry }) => ({
        ...entry,
        id: crypto.randomUUID(),
        projectId,
        characterIds: resolveCharacterNames(characterNames, nameToId),
        createdAt: now,
        updatedAt: now,
      })),
    )
  }

  const existingEvents = await timelineEvents
    .filter((event) => event.projectId === projectId)
    .count()
  if (existingEvents === 0) {
    await timelineEvents.bulkAdd(
      seedTimelineEvents.map(({ characterNames, ...event }) => ({
        ...event,
        id: crypto.randomUUID(),
        projectId,
        characterIds: resolveCharacterNames(characterNames, nameToId),
        createdAt: now,
        updatedAt: now,
      })),
    )
  }
}
