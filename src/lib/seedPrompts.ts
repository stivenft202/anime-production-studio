/**
 * Siembra del prompt DEMO de estilo (copia pública).
 *
 * Un único prompt INVENTADO para demostrar la biblioteca de prompts:
 * una hoja de personaje de ejemplo, con estilo de dibujo genérico.
 * No pertenece a ningún proyecto real.
 *
 * SEGURIDAD: `seedPromptsIfNeeded` solo la llama `seedIfEmpty()` y
 * solo cuando la base de datos estaba vacía (el proyecto demo se
 * acaba de crear en esta misma siembra). Recibe el ID del proyecto
 * demo y el mapa de personajes demo directamente: NUNCA busca un
 * proyecto por nombre y NUNCA marca ningún flag (el único flag demo,
 * `seed_demo_v1`, lo marca `seedIfEmpty()` al final, solo si toda la
 * siembra escribió correctamente).
 */
import { db, type PromptEntry } from '../db/db'

/** Contenido del prompt demo: hoja de personaje de ejemplo, estilo genérico. */
export const SEED_PROMPT_DEMO_CONTENT =
  'Dibuja desde cero una hoja de personaje de una exploradora llamada Mara, de 28 años, complexión atlética, cabello castaño recogido en una trenza, ojos verdes, vistiendo chaqueta verde oliva, pantalón marrón y botas de cuero, con una libreta de mapas en la mano. (ver imagen de referencia)\n\n' +
  'RENDERIZA TODO el personaje con la técnica de dibujo de la imagen de referencia: lineart de grosor irregular y trazo manual, cell shading suave con bordes ligeramente difusos sin gradientes artificiales, piel con textura y variación de tono natural, un solo brillo simple en los ojos pintado a mano, mechones de cabello de grosor irregular y no perfectamente simétricos, paleta poco saturada.\n\n' +
  'PROHIBIDO usar sombreado tipo render 3D, brillo ceroso o plastificado en piel y cabello, simetría facial perfecta, lineart vectorial uniforme, múltiples reflejos en los ojos, degradados de color en cabello u ojos, o cualquier acabado pulido típico de ilustración generada por IA sin retoque. El resultado debe verse como si el mismo ilustrador humano que dibujó la referencia hubiera dibujado también a Mara desde cero, con sus mismas imperfecciones de trazo.\n\n' +
  'COMPOSICIÓN OBLIGATORIA DE LA HOJA, fondo blanco liso sin sombras de escena:\n\n' +
  'ARRIBA: tres vistas de cuerpo completo en fila, en este orden: de perfil, de espalda y de frente.\n\n' +
  'ABAJO: tres vistas de medio cuerpo en primer plano en fila, en este orden: de perfil, de espalda y de frente.'

export const SEED_PROMPT_DEMO_NAME = 'Hoja de personaje — estilo demo'

/**
 * Siembra el prompt demo en el proyecto demo, si aún no existe.
 * Resuelve el personaje Mara desde el mapa de personajes demo que
 * recibe (sin búsquedas por nombre). No marca ningún flag.
 */
export async function seedPromptsIfNeeded(
  projectId: string,
  nameToId: Map<string, string>,
): Promise<void> {
  const existing = await db.prompts
    .where('projectId')
    .equals(projectId)
    .filter((p) => p.name === SEED_PROMPT_DEMO_NAME)
    .first()
  if (existing) return

  const now = Date.now()
  const maraId = nameToId.get('Mara')

  const entry: PromptEntry = {
    id: crypto.randomUUID(),
    projectId,
    name: SEED_PROMPT_DEMO_NAME,
    content: SEED_PROMPT_DEMO_CONTENT,
    category: 'personajes',
    generationType: 'imagen',
    aiModel: '',
    platform: '',
    language: 'español',
    description:
      'Prompt demo de ejemplo: hoja de personaje con estilo de dibujo genérico. Datos inventados para probar la biblioteca de prompts.',
    tags: ['estilo', 'demo', 'hoja de personaje'],
    characterIds: maraId ? [maraId] : [],
    episodeId: undefined,
    sceneId: undefined,
    shotId: undefined,
    technicalParams: '',
    negativePrompt: '',
    durationSeconds: undefined,
    aspectRatio: '',
    resolution: '',
    imageAssetIds: [],
    generatedResultAssetId: undefined,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.prompts.add(entry)
}
