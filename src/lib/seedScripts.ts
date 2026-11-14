/**
 * Datos semilla DEMO de guiones y episodios (copia pública).
 *
 * Crea los 3 episodios demo de `src/lib/seedEpisodes.ts` (lugares y
 * personajes inventados) y 3 escenas demo del episodio 1. Sin
 * diálogos: las escenas son solo título y número, para probar el
 * módulo de guiones.
 *
 * SEGURIDAD: `seedEpisodesIfNeeded` solo la llama `seedIfEmpty()` y
 * solo cuando la base de datos estaba vacía (el proyecto demo se
 * acaba de crear en esta misma siembra). Recibe el ID del proyecto
 * demo y el mapa de personajes demo directamente: NUNCA busca un
 * proyecto por nombre y NUNCA marca ningún flag (el único flag demo,
 * `seed_demo_v1`, lo marca `seedIfEmpty()` al final, solo si toda la
 * siembra escribió correctamente).
 *
 * Idempotente dentro de la siembra: cada paso comprueba antes de
 * escribir, así que si la siembra se interrumpe a mitad, un
 * reintento no duplica nada.
 */
import { db } from '../db/db'
import { seedEpisodes } from './seedEpisodes'

/** Escenas demo del episodio 1 (títulos inventados). */
const EPISODE_1_SCENES: { number: number; title: string }[] = [
  { number: 1, title: 'Escena 1 — Mara llega a Puerto Bruma' },
  { number: 2, title: 'Escena 2 — El mapa incompleto' },
  { number: 3, title: 'Escena 3 — Camino al Valle del Eco' },
]

export async function seedEpisodesIfNeeded(
  projectId: string,
  nameToId: Map<string, string>,
): Promise<void> {
  const now = Date.now()

  // 1. Los 3 episodios demo (solo si el proyecto aún no tiene ninguno).
  const existingEpisodes = await db.episodes.where('projectId').equals(projectId).count()
  if (existingEpisodes === 0) {
    await db.episodes.bulkAdd(
      seedEpisodes.map((seed) => ({
        id: crypto.randomUUID(),
        projectId,
        number: seed.number,
        title: seed.title,
        synopsis: '',
        status: 'borrador' as const,
        language: 'español',
        characterIds: seed.characters
          .map((name) => nameToId.get(name))
          .filter((id): id is string => Boolean(id)),
        placeNames: [...seed.places],
        createdAt: now,
        updatedAt: now,
      })),
    )
  }

  // 2. Escenas demo del episodio 1 (solo si el ep. 1 existe y no tiene escenas).
  const episode1 = await db.episodes
    .where('projectId')
    .equals(projectId)
    .filter((e) => e.number === 1)
    .first()
  if (episode1) {
    const existingScenes = await db.scenes.where('episodeId').equals(episode1.id).count()
    if (existingScenes === 0) {
      await db.scenes.bulkAdd(
        EPISODE_1_SCENES.map((scene, index) => ({
          id: crypto.randomUUID(),
          projectId,
          episodeId: episode1.id,
          number: scene.number,
          title: scene.title,
          locationName: '',
          description: '',
          timeOfDay: '',
          characterIds: [],
          imageAssetIds: [],
          promptIds: [],
          orderIndex: index,
          createdAt: now,
          updatedAt: now,
        })),
      )
    }
  }
}
