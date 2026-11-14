import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Copy, Pencil, Trash2, User } from 'lucide-react';
import { db } from '../../db/db';
import {
  deleteCharacterCascade,
  duplicateCharacter,
  getCharacterMainImageUrlFor,
  tables,
  type Character,
} from '../../lib/characters';
import { episodeLabel } from '../../lib/scripts';
import { useAppStore } from '../../store/appStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GalleryManager } from './GalleryManager';
import { OutfitManager } from './OutfitManager';
import { RelationshipPicker } from './RelationshipPicker';

interface CharacterDetailProps {
  characterId: string;
  onBack: () => void;
  onEdit: (character: Character) => void;
  onDeleted: () => void;
}

export function CharacterDetail({ characterId, onBack, onEdit, onDeleted }: CharacterDetailProps) {
  const character = useLiveQuery(() => tables(db).characters.get(characterId), [characterId]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!character) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    void getCharacterMainImageUrlFor(db, character).then((url) => {
      if (!cancelled) setImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [character]);

  if (character === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando personaje…</p>;
  }

  if (!character) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <p className="text-sm text-muted-foreground">Este personaje ya no existe.</p>
      </div>
    );
  }

  const handleDuplicate = async () => {
    await duplicateCharacter(db, character.id);
  };

  const handleDelete = async () => {
    await deleteCharacterCascade(db, character.id);
    setConfirmDelete(false);
    onDeleted();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => onEdit(character)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
        <Button variant="outline" onClick={() => void handleDuplicate()}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </Button>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </div>

      {/* Cabecera */}
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="flex h-64 w-full shrink-0 items-center justify-center bg-muted sm:h-auto sm:w-64">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <CardContent className="flex-1 space-y-2 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{character.name}</h1>
              <Badge>{character.role}</Badge>
              <Badge variant="secondary">{character.species}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {character.age ? `${character.age} años` : 'Edad sin dato'}
              {character.occupation ? ` · ${character.occupation}` : ''}
              {character.internalId ? ` · ID interno: ${character.internalId}` : ''}
            </p>
            {character.description && <p className="text-sm">{character.description}</p>}
            {character.personality && (
              <p className="text-sm">
                <span className="font-medium">Personalidad: </span>
                {character.personality}
              </p>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Información general */}
      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
        </CardHeader>
        <CardContent>
          {character.biography ? (
            <p className="text-sm leading-relaxed">{character.biography}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin biografía registrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Apariencia */}
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <AppearanceRow label="Pelo" value={character.hair} />
            <AppearanceRow
              label="Color de pelo"
              value={character.hairColor}
              swatch={character.hairColor}
            />
            <AppearanceRow label="Ojos" value={character.eyes} />
            <AppearanceRow
              label="Color de ojos"
              value={character.eyeColorHex}
              swatch={character.eyeColorHex}
            />
            <AppearanceRow
              label="Estatura"
              value={character.height ? `${character.height} cm` : ''}
            />
            <AppearanceRow label="Complexión" value={character.build} />
            <AppearanceRow label="Piel" value={character.skin} />
            <AppearanceRow label="Rasgos distintivos" value={character.distinctiveFeatures} />
            <AppearanceRow label="Vestimenta" value={character.clothing} />
          </dl>
        </CardContent>
      </Card>

      {/* Voz y personalidad vocal */}
      <Card>
        <CardHeader>
          <CardTitle>Voz y personalidad vocal</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <AppearanceRow label="Idioma" value={character.voiceLanguage} />
            <AppearanceRow label="Tono de voz" value={character.voiceTone} />
            <AppearanceRow label="Edad vocal" value={character.vocalAge} />
            <AppearanceRow label="Acento" value={character.accent} />
            <AppearanceRow label="Actor de voz" value={character.voiceActorId ?? ''} />
            <AppearanceRow label="Notas de interpretación" value={character.performanceNotes} />
          </dl>
        </CardContent>
      </Card>

      {/* Galería */}
      <Card>
        <CardHeader>
          <CardTitle>Galería</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryManager characterId={character.id} projectId={character.projectId} />
        </CardContent>
      </Card>

      {/* Vestimentas */}
      <Card>
        <CardHeader>
          <CardTitle>Vestimentas</CardTitle>
        </CardHeader>
        <CardContent>
          <OutfitManager characterId={character.id} projectId={character.projectId} />
        </CardContent>
      </Card>

      {/* Relaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Relaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <RelationshipPicker characterId={character.id} projectId={character.projectId} />
        </CardContent>
      </Card>

      {/* Apariciones */}
      <Card>
        <CardHeader>
          <CardTitle>Apariciones</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterAppearances characterId={character.id} projectId={character.projectId} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Eliminar a ${character.name}`}
        message="Se eliminará el personaje con su galería, sus vestimentas y sus relaciones. Esta acción no se puede deshacer."
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

/** Episodios, escenas y diálogos reales donde aparece el personaje (fase 3). */
function CharacterAppearances({
  characterId,
  projectId,
}: {
  characterId: string;
  projectId: string;
}) {
  const setSection = useAppStore((s) => s.setSection);
  const episodes = useLiveQuery(
    () => db.episodes.where('projectId').equals(projectId).sortBy('number'),
    [projectId],
  );
  const scenes = useLiveQuery(
    () => db.scenes.where('projectId').equals(projectId).sortBy('orderIndex'),
    [projectId],
  );
  const dialogueCount = useLiveQuery(
    () =>
      db.dialogueLines
        .where('characterId')
        .equals(characterId)
        .count(),
    [characterId],
  );

  if (!episodes || !scenes) {
    return <p className="text-sm text-muted-foreground">Cargando apariciones…</p>;
  }

  const appearingEpisodes = episodes.filter((e) => e.characterIds.includes(characterId));
  const appearingScenes = scenes.filter((s) => s.characterIds.includes(characterId));
  const episodeById = new Map(episodes.map((e) => [e.id, e]));

  if (appearingEpisodes.length === 0 && appearingScenes.length === 0 && !dialogueCount) {
    return (
      <p className="text-sm text-muted-foreground">
        Este personaje no aparece en ningún episodio, escena ni diálogo
        todavía.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium">Episodios</p>
        {appearingEpisodes.length === 0 ? (
          <p className="text-muted-foreground">Sin episodios.</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {appearingEpisodes.map((e) => (
              <Button key={e.id} variant="outline" size="sm" onClick={() => setSection('guiones')}>
                {episodeLabel(e)}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="font-medium">Escenas</p>
        {appearingScenes.length === 0 ? (
          <p className="text-muted-foreground">Sin escenas.</p>
        ) : (
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {appearingScenes.map((s) => {
              const ep = episodeById.get(s.episodeId);
              return (
                <li key={s.id}>
                  Escena {s.number}
                  {s.title ? ` — ${s.title}` : ''}
                  {ep ? ` (${episodeLabel(ep)})` : ''}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-muted-foreground">
        {dialogueCount === 1
          ? '1 línea de diálogo en total.'
          : `${dialogueCount ?? 0} líneas de diálogo en total.`}
      </p>
      <p className="text-xs text-muted-foreground">
        Al pulsar un episodio se abre la sección Guiones.
      </p>
    </div>
  );
}

function AppearanceRow({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-36 shrink-0 font-medium text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2">
        {swatch && /^#[0-9a-fA-F]{6}$/.test(swatch) && (
          <span
            className="inline-block h-4 w-4 shrink-0 rounded-full border"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span>{value || '—'}</span>
      </dd>
    </div>
  );
}
