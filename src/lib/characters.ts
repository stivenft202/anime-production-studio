/**
 * Helpers del módulo de Personajes.
 *
 * Las entidades se definen aquí (fuente única de tipos para este módulo)
 * y se accede a las tablas Dexie por nombre (`db.table('characters')`),
 * de modo que este módulo no depende de cómo `src/db/db.ts` declare
 * sus tipos: solo exige que existan las tablas con estos nombres y
 * estos campos (contrato de datos de la fase 1).
 */
import type Dexie from 'dexie';
import { deleteAssetFile, getAssetUrl } from './files';
import type { AssetRef } from './files';

/* ------------------------------------------------------------------ */
/* Tipos de entidad (contrato de datos, fase 1)                        */
/* ------------------------------------------------------------------ */

export interface Character {
  id: string;
  projectId: string;
  name: string;
  internalId: string;
  age: number;
  species: string;
  occupation: string;
  role: string;
  description: string;
  personality: string;
  biography: string;
  hair: string;
  hairColor: string;
  eyes: string;
  eyeColorHex: string;
  height: number;
  build: string;
  skin: string;
  distinctiveFeatures: string;
  clothing: string;
  voiceActorId?: string;
  voiceLanguage: string;
  voiceTone: string;
  vocalAge: string;
  accent: string;
  performanceNotes: string;
  mainImageId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Campos editables de un personaje (sin id ni metadatos). */
export type CharacterInput = Omit<Character, 'id' | 'projectId' | 'mainImageId' | 'createdAt' | 'updatedAt'>;

export type ImageCategory =
  | 'rostro'
  | 'cuerpo'
  | 'vestimenta'
  | 'expresiones'
  | 'poses'
  | 'alternativos'
  | 'otro';

export const IMAGE_CATEGORIES: { value: ImageCategory; label: string }[] = [
  { value: 'rostro', label: 'Rostro' },
  { value: 'cuerpo', label: 'Cuerpo completo' },
  { value: 'vestimenta', label: 'Vestimenta' },
  { value: 'expresiones', label: 'Expresiones' },
  { value: 'poses', label: 'Poses' },
  { value: 'alternativos', label: 'Alternativos' },
  { value: 'otro', label: 'Otro' },
];

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  rostro: 'Rostro',
  cuerpo: 'Cuerpo completo',
  vestimenta: 'Vestimenta',
  expresiones: 'Expresiones',
  poses: 'Poses',
  alternativos: 'Alternativos',
  otro: 'Otro',
};

export interface CharacterImage {
  id: string;
  characterId: string;
  assetId: string;
  category: ImageCategory;
  isMain: boolean;
  sortOrder: number;
}

export interface CharacterOutfit {
  id: string;
  characterId: string;
  name: string;
  description: string;
  imageIds: string[];
  isDefault: boolean;
}

export type RelationshipType =
  | 'familiar'
  | 'amigo'
  | 'enemigo'
  | 'aliado'
  | 'rival'
  | 'maestro'
  | 'alumno'
  | 'otro';

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'familiar', label: 'Familiar' },
  { value: 'amigo', label: 'Amigo' },
  { value: 'enemigo', label: 'Enemigo' },
  { value: 'aliado', label: 'Aliado' },
  { value: 'rival', label: 'Rival' },
  { value: 'maestro', label: 'Maestro' },
  { value: 'alumno', label: 'Alumno' },
  { value: 'otro', label: 'Otro' },
];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  familiar: 'familiar',
  amigo: 'amigo',
  enemigo: 'enemigo',
  aliado: 'aliado',
  rival: 'rival',
  maestro: 'maestro',
  alumno: 'alumno',
  otro: 'otro',
};

/** Cómo se lee el tipo al revés (desde el otro extremo de la relación). */
export const RELATIONSHIP_INVERSE_LABELS: Record<RelationshipType, string> = {
  familiar: 'familiar',
  amigo: 'amigo',
  enemigo: 'enemigo',
  aliado: 'aliado',
  rival: 'rival',
  maestro: 'alumno',
  alumno: 'maestro',
  otro: 'otro',
};

export interface CharacterRelationship {
  id: string;
  projectId: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  label?: string;
  description?: string;
}

/** Fila de la tabla `assets` (el registro es compatible con AssetRef). */
export type AssetRow = AssetRef & {
  id: string;
  projectId: string;
};

/* ------------------------------------------------------------------ */
/* Acceso a tablas                                                     */
/* ------------------------------------------------------------------ */

export function tables(db: Dexie) {
  return {
    characters: db.table<Character, string>('characters'),
    characterImages: db.table<CharacterImage, string>('characterImages'),
    characterOutfits: db.table<CharacterOutfit, string>('characterOutfits'),
    characterRelationships: db.table<CharacterRelationship, string>('characterRelationships'),
    assets: db.table<AssetRow, string>('assets'),
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/* ------------------------------------------------------------------ */
/* Imagen principal                                                    */
/* ------------------------------------------------------------------ */

/**
 * Devuelve la URL de la imagen principal del personaje (o null si no
 * tiene ninguna imagen). Busca `mainImageId`, si no la imagen marcada
 * como principal, y si no la primera imagen por orden.
 */
export async function getCharacterMainImageUrl(character: Character): Promise<string | null> {
  // Se importa db aquí de forma perezosa a través del módulo: este helper
  // recibe el personaje pero no la instancia, así que usa la instancia
  // global. Si el proyecto cambia de instancia, usar getCharacterMainImageUrlFor.
  const { db } = await import('../db/db');
  return getCharacterMainImageUrlFor(db, character);
}

export async function getCharacterMainImageUrlFor(
  db: Dexie,
  character: Character,
): Promise<string | null> {
  const t = tables(db);
  let image: CharacterImage | undefined;
  if (character.mainImageId) {
    image = await t.characterImages.get(character.mainImageId);
  }
  if (!image) {
    image = await t.characterImages
      .where('characterId')
      .equals(character.id)
      .filter((img) => img.isMain)
      .first();
  }
  if (!image) {
    image = await t.characterImages
      .where('characterId')
      .equals(character.id)
      .sortBy('sortOrder')
      .then((imgs) => imgs[0]);
  }
  if (!image) return null;
  const asset = await t.assets.get(image.assetId);
  if (!asset) return null;
  return getAssetUrl(asset as unknown as AssetRef);
}

/* ------------------------------------------------------------------ */
/* Relaciones (ambos sentidos)                                         */
/* ------------------------------------------------------------------ */

export interface CharacterRelationshipView {
  relationship: CharacterRelationship;
  /** 'saliente': el personaje es el origen; 'entrante': es el destino. */
  direction: 'saliente' | 'entrante';
  otherCharacterId: string;
  otherCharacterName: string;
  /** Frase legible, p. ej. "Mara es rival de Dario" o "Dario es maestro de Mara". */
  sentence: string;
  /** La misma relación leída desde el otro extremo, p. ej. "Mara es alumna de Dario". */
  inverseSentence: string;
}

/**
 * Relaciones de un personaje en AMBOS sentidos, con frases legibles.
 * El tipo se invierte cuando la relación apunta al personaje
 * (maestro ↔ alumno; el resto son simétricos).
 */
export async function getCharacterRelationships(
  db: Dexie,
  characterId: string,
): Promise<CharacterRelationshipView[]> {
  const t = tables(db);
  const me = await t.characters.get(characterId);
  const myName = me?.name ?? 'Este personaje';

  const outgoing = await t.characterRelationships.where('fromId').equals(characterId).toArray();
  const incoming = await t.characterRelationships.where('toId').equals(characterId).toArray();

  const views: CharacterRelationshipView[] = [];

  for (const rel of outgoing) {
    const other = await t.characters.get(rel.toId);
    const otherName = other?.name ?? 'Personaje eliminado';
    const label = rel.label?.trim() || RELATIONSHIP_TYPE_LABELS[rel.type];
    const inverseLabel = rel.label?.trim() || RELATIONSHIP_INVERSE_LABELS[rel.type];
    views.push({
      relationship: rel,
      direction: 'saliente',
      otherCharacterId: rel.toId,
      otherCharacterName: otherName,
      sentence: `${myName} es ${label} de ${otherName}`,
      inverseSentence: `${otherName} es ${inverseLabel} de ${myName}`,
    });
  }

  for (const rel of incoming) {
    const other = await t.characters.get(rel.fromId);
    const otherName = other?.name ?? 'Personaje eliminado';
    const label = rel.label?.trim() || RELATIONSHIP_TYPE_LABELS[rel.type];
    const inverseLabel = rel.label?.trim() || RELATIONSHIP_INVERSE_LABELS[rel.type];
    views.push({
      relationship: rel,
      direction: 'entrante',
      otherCharacterId: rel.fromId,
      otherCharacterName: otherName,
      sentence: `${otherName} es ${label} de ${myName}`,
      inverseSentence: `${myName} es ${inverseLabel} de ${otherName}`,
    });
  }

  return views;
}

/* ------------------------------------------------------------------ */
/* Duplicar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Duplica un personaje con sus vestimentas y su galería.
 * Las imágenes reutilizan los mismos assetIds (nuevas filas
 * characterImages apuntando a los mismos archivos).
 * Las relaciones NO se duplican.
 * Devuelve el id del personaje nuevo.
 */
export async function duplicateCharacter(db: Dexie, characterId: string): Promise<string> {
  const t = tables(db);
  const original = await t.characters.get(characterId);
  if (!original) throw new Error('Personaje no encontrado');

  const timestamp = now();
  const newCharacterId = newId();

  const copy: Character = {
    ...original,
    id: newCharacterId,
    name: `${original.name} (copia)`,
    mainImageId: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await t.characters.add(copy);

  // Galería: nuevas filas, mismos assetIds.
  const images = await t.characterImages.where('characterId').equals(characterId).toArray();
  let newMainImageId: string | undefined;
  for (const img of images) {
    const newImageId = newId();
    await t.characterImages.add({
      ...img,
      id: newImageId,
      characterId: newCharacterId,
    });
    if (img.isMain) newMainImageId = newImageId;
  }
  if (newMainImageId) {
    await t.characters.update(newCharacterId, { mainImageId: newMainImageId });
  }

  // Vestimentas: nuevas filas, mismas imageIds (mismos archivos).
  const outfits = await t.characterOutfits.where('characterId').equals(characterId).toArray();
  for (const outfit of outfits) {
    await t.characterOutfits.add({
      ...outfit,
      id: newId(),
      characterId: newCharacterId,
    });
  }

  return newCharacterId;
}

/* ------------------------------------------------------------------ */
/* Eliminar en cascada                                                 */
/* ------------------------------------------------------------------ */

/**
 * Borra el archivo de un asset solo si ningún otro personaje lo
 * referencia (galería u outfit de otro personaje). Devuelve true si
 * lo borró.
 */
export async function deleteAssetFileIfUnreferenced(
  db: Dexie,
  assetId: string,
  excludeCharacterId?: string,
): Promise<boolean> {
  const t = tables(db);
  const usedByImages = await t.characterImages
    .where('assetId')
    .equals(assetId)
    .filter((img) => img.characterId !== excludeCharacterId)
    .count();
  const usedByOutfits = await t.characterOutfits.toArray().then((all) =>
    all.some((o) => o.characterId !== excludeCharacterId && o.imageIds.includes(assetId)),
  );
  if (usedByImages > 0 || usedByOutfits) return false;
  const asset = await t.assets.get(assetId);
  if (!asset) return false;
  try {
    await deleteAssetFile(asset as unknown as AssetRef);
    return true;
  } catch {
    return false;
  }
}

/**
 * Borra un personaje, sus imágenes, sus vestimentas y sus relaciones
 * en ambos sentidos. Los archivos se borran con deleteAssetFile solo
 * cuando ningún otro registro los referencia (un personaje duplicado
 * comparte los mismos assetIds, así que borrar el archivo a ciegas
 * rompería al duplicado).
 */
export async function deleteCharacterCascade(db: Dexie, characterId: string): Promise<void> {
  const t = tables(db);

  // 1. Recoger todos los assetIds propios (galería + vestimentas).
  const images = await t.characterImages.where('characterId').equals(characterId).toArray();
  const outfits = await t.characterOutfits.where('characterId').equals(characterId).toArray();
  const ownAssetIds = new Set<string>();
  for (const img of images) ownAssetIds.add(img.assetId);
  for (const outfit of outfits) {
    for (const assetId of outfit.imageIds) ownAssetIds.add(assetId);
  }

  // 2. Borrar el archivo solo si nadie más lo usa.
  for (const assetId of ownAssetIds) {
    const stillUsedByImages = await t.characterImages
      .where('assetId')
      .equals(assetId)
      .filter((img) => img.characterId !== characterId)
      .count();
    const stillUsedByOutfits = await t.characterOutfits
      .toArray()
      .then((all) =>
        all.some((o) => o.characterId !== characterId && o.imageIds.includes(assetId)),
      );
    if (stillUsedByImages === 0 && !stillUsedByOutfits) {
      const asset = await t.assets.get(assetId);
      if (asset) {
        try {
          await deleteAssetFile(asset as unknown as AssetRef);
        } catch {
          // El archivo ya no existe o no se pudo borrar: no bloquea
          // la eliminación del personaje.
        }
      }
    }
  }

  // 3. Borrar filas propias.
  await t.characterImages.where('characterId').equals(characterId).delete();
  await t.characterOutfits.where('characterId').equals(characterId).delete();
  await t.characterRelationships.where('fromId').equals(characterId).delete();
  await t.characterRelationships.where('toId').equals(characterId).delete();
  await t.characters.delete(characterId);
}
