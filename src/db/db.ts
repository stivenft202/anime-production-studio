import Dexie, { type Table } from 'dexie'

export interface Project {
  id: string
  name: string
  logoAssetId?: string
  coverAssetId?: string
  description: string
  genre: string
  synopsis: string
  status: string
  createdAt: number
  updatedAt: number
  language: string
  tags: string[]
  team: string[]
  socialLinks: { label: string; url: string }[]
}

export type CharacterImageCategory =
  | 'rostro'
  | 'cuerpo'
  | 'vestimenta'
  | 'expresiones'
  | 'poses'
  | 'alternativos'
  | 'otro'

export interface Character {
  id: string
  projectId: string
  name: string
  internalId: string
  age: number
  species: string
  occupation: string
  role: string
  description: string
  personality: string
  biography: string
  hair: string
  hairColor: string
  eyes: string
  eyeColorHex: string
  height: number
  build: string
  skin: string
  distinctiveFeatures: string
  clothing: string
  voiceActorId?: string
  voiceLanguage: string
  voiceTone: string
  vocalAge: string
  accent: string
  performanceNotes: string
  mainImageId?: string
  createdAt: number
  updatedAt: number
}

export interface CharacterImage {
  id: string
  characterId: string
  assetId: string
  category: CharacterImageCategory
  isMain: boolean
  sortOrder: number
}

export interface CharacterOutfit {
  id: string
  characterId: string
  name: string
  description: string
  imageIds: string[]
  isDefault: boolean
}

export type RelationshipType =
  | 'familiar'
  | 'amigo'
  | 'enemigo'
  | 'aliado'
  | 'rival'
  | 'maestro'
  | 'alumno'
  | 'otro'

export interface CharacterRelationship {
  id: string
  projectId: string
  fromId: string
  toId: string
  type: RelationshipType
  label?: string
  description?: string
}

export interface Asset {
  id: string
  projectId: string
  name: string
  mime: string
  size: number
  storage: 'indexeddb' | 'disk'
  path?: string
  blobId?: string
  category?: string
  /** Etiquetas libres (fase 4: galería de referencias). */
  tags?: string[]
  createdAt: number
}

export interface AssetBlob {
  id: string
  blob: Blob
}

export interface Setting {
  key: string
  value: string
}

/* ------------------------------------------------------------------ */
/* Lore / Universo (fase 2)                                            */
/* ------------------------------------------------------------------ */

export type LoreEntryType =
  | 'historia-mundo'
  | 'reglas'
  | 'faccion'
  | 'organizacion'
  | 'especie'
  | 'criatura'
  | 'sistema-poder'
  | 'tecnologia'
  | 'religion'
  | 'leyenda'
  | 'acontecimiento'
  | 'misterio'
  | 'concepto'

export interface LoreEntry {
  id: string
  projectId: string
  title: string
  type: LoreEntryType
  description: string
  history: string
  features: string
  rules: string
  tags: string[]
  spoiler: boolean
  characterIds: string[]
  locationNames: string[]
  episodeNumbers: number[]
  imageAssetIds: string[]
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface TimelineEvent {
  id: string
  projectId: string
  title: string
  fictionalDate: string
  era: string
  description: string
  consequences: string
  spoiler: boolean
  characterIds: string[]
  locationNames: string[]
  imageAssetIds: string[]
  orderIndex: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------------------------------------------ */
/* Guiones y episodios                                                 */
/* ------------------------------------------------------------------ */

export type EpisodeStatus = 'borrador' | 'en-escritura' | 'terminado' | 'publicado'

export interface Episode {
  id: string
  projectId: string
  /** Temporada opcional (si la serie se organiza en temporadas). */
  seasonNumber?: number
  number: number
  title: string
  synopsis: string
  status: EpisodeStatus
  /** Duración estimada en segundos. */
  durationSeconds?: number
  language: string
  coverAssetId?: string
  characterIds: string[]
  /** Lugares del episodio (nombres; los lugares detallados llegan en la fase 5). */
  placeNames: string[]
  /** Guion completo en formato Tiptap (JSON serializado). */
  scriptJson?: string
  /** Guion en texto plano (para exportar y buscar). */
  scriptText?: string
  createdAt: number
  updatedAt: number
}

export interface Scene {
  id: string
  projectId: string
  episodeId: string
  number: number
  title: string
  /** Nombre del lugar (los lugares detallados llegan en la fase 5). */
  locationName: string
  description: string
  /** Momento temporal (p. ej. "Noche", "Amanecer"). */
  timeOfDay: string
  characterIds: string[]
  imageAssetIds: string[]
  promptIds: string[]
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export type ShotResultStatus = 'borrador' | 'en-progreso' | 'terminado' | 'descartado'

export interface Shot {
  id: string
  projectId: string
  sceneId: string
  number: number
  visualDescription: string
  action: string
  cameraMovement: string
  framing: string
  durationSeconds?: number
  characterIds: string[]
  imageAssetIds: string[]
  promptId?: string
  aiModel?: string
  generatedVideoAssetId?: string
  resultStatus: ShotResultStatus
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface DialogueLine {
  id: string
  projectId: string
  episodeId: string
  sceneId?: string
  shotId?: string
  characterId?: string
  text: string
  performanceNotes: string
  emotion: string
  language: string
  /** Actor de voz asignado (los actores detallados llegan en la fase 5). */
  voiceActorName?: string
  audioAssetId?: string
  orderIndex: number
  createdAt: number
  updatedAt: number
}

/* ------------------------------------------------------------------ */
/* Biblioteca de prompts y referencias visuales (fase 4)               */
/* ------------------------------------------------------------------ */

export type PromptCategory =
  | 'imagen'
  | 'video'
  | 'animacion'
  | 'voz'
  | 'musica'
  | 'edicion'
  | 'escenarios'
  | 'personajes'
  | 'expresiones'
  | 'movimiento-camara'
  | 'otros'

export interface PromptEntry {
  id: string
  projectId: string
  name: string
  content: string
  category: PromptCategory
  /** Tipo de generación (imagen, vídeo, voz, música…). */
  generationType: string
  aiModel: string
  platform: string
  language: string
  description: string
  tags: string[]
  characterIds: string[]
  episodeId?: string
  sceneId?: string
  shotId?: string
  /** Parámetros técnicos (texto libre: pasos, CFG, semilla…). */
  technicalParams: string
  negativePrompt: string
  durationSeconds?: number
  aspectRatio: string
  resolution: string
  imageAssetIds: string[]
  generatedResultAssetId?: string
  isFavorite: boolean
  createdAt: number
  updatedAt: number
}

/** Variante de un prompt: registro independiente relacionado con su original. */
export interface PromptVariant {
  id: string
  projectId: string
  promptId: string
  name: string
  content: string
  note: string
  createdAt: number
  updatedAt: number
}

/** Enlace de un archivo a un elemento (un asset puede enlazarse a varios). */
export type AssetLinkTargetType =
  | 'personaje'
  | 'episodio'
  | 'escena'
  | 'plano'
  | 'lugar'
  | 'objeto'
  | 'prompt'
  | 'lore'

export interface AssetLink {
  id: string
  projectId: string
  assetId: string
  targetType: AssetLinkTargetType
  targetId: string
  createdAt: number
}

export class AnimeStudioDB extends Dexie {
  projects!: Table<Project, string>
  characters!: Table<Character, string>
  characterImages!: Table<CharacterImage, string>
  characterOutfits!: Table<CharacterOutfit, string>
  characterRelationships!: Table<CharacterRelationship, string>
  assets!: Table<Asset, string>
  assetBlobs!: Table<AssetBlob, string>
  settings!: Table<Setting, string>
  loreEntries!: Table<LoreEntry, string>
  timelineEvents!: Table<TimelineEvent, string>
  episodes!: Table<Episode, string>
  scenes!: Table<Scene, string>
  shots!: Table<Shot, string>
  dialogueLines!: Table<DialogueLine, string>
  prompts!: Table<PromptEntry, string>
  promptVariants!: Table<PromptVariant, string>
  assetLinks!: Table<AssetLink, string>

  constructor() {
    super('anime-production-studio')
    this.version(1).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      characters: 'id, projectId, name, internalId, createdAt, updatedAt',
      characterImages: 'id, characterId, assetId, category, isMain, sortOrder',
      characterOutfits: 'id, characterId, name, isDefault',
      characterRelationships: 'id, projectId, fromId, toId, type',
      assets: 'id, projectId, name, storage, category, createdAt',
      assetBlobs: 'id',
      settings: 'key',
    })
    // Fase 2: Universo y lore. La versión 2 repite el esquema completo de
    // la v1 (Dexie lo exige) y añade las dos tablas nuevas.
    this.version(2).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      characters: 'id, projectId, name, internalId, createdAt, updatedAt',
      characterImages: 'id, characterId, assetId, category, isMain, sortOrder',
      characterOutfits: 'id, characterId, name, isDefault',
      characterRelationships: 'id, projectId, fromId, toId, type',
      assets: 'id, projectId, name, storage, category, createdAt',
      assetBlobs: 'id',
      settings: 'key',
      loreEntries: 'id, projectId, type, title, createdAt, updatedAt',
      timelineEvents: 'id, projectId, era, title, orderIndex, createdAt',
    })
    // Fases 3 y 4: guiones/episodios, biblioteca de prompts y enlaces de
    // archivos. Repite el esquema completo de la v2 y añade las nuevas
    // tablas. La 0001 de Supabase ya tenía episodes/scenes/shots/
    // dialogue_lines/prompts/assets; la 0003 añade lo que falta allí
    // (variantes de prompt, enlaces de asset y columnas extra).
    this.version(3).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      characters: 'id, projectId, name, internalId, createdAt, updatedAt',
      characterImages: 'id, characterId, assetId, category, isMain, sortOrder',
      characterOutfits: 'id, characterId, name, isDefault',
      characterRelationships: 'id, projectId, fromId, toId, type',
      assets: 'id, projectId, name, storage, category, createdAt',
      assetBlobs: 'id',
      settings: 'key',
      loreEntries: 'id, projectId, type, title, createdAt, updatedAt',
      timelineEvents: 'id, projectId, era, title, orderIndex, createdAt',
      episodes: 'id, projectId, number, status, createdAt, updatedAt',
      scenes: 'id, projectId, episodeId, number, orderIndex',
      shots: 'id, projectId, sceneId, number, orderIndex',
      dialogueLines: 'id, projectId, episodeId, sceneId, characterId, orderIndex',
      prompts: 'id, projectId, category, aiModel, isFavorite, createdAt, updatedAt',
      promptVariants: 'id, promptId, projectId, createdAt',
      assetLinks: 'id, assetId, projectId, targetType, targetId',
    })
  }
}

export const db = new AnimeStudioDB()
