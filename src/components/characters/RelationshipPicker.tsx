import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, Users } from 'lucide-react';
import { db } from '../../db/db';
import {
  getCharacterRelationships,
  newId,
  RELATIONSHIP_TYPES,
  tables,
  type CharacterRelationship,
  type CharacterRelationshipView,
  type RelationshipType,
} from '../../lib/characters';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface RelationshipPickerProps {
  characterId: string;
  projectId: string;
}

export function RelationshipPicker({ characterId, projectId }: RelationshipPickerProps) {
  const others = useLiveQuery(
    () =>
      tables(db)
        .characters.where('projectId')
        .equals(projectId)
        .filter((c) => c.id !== characterId)
        .sortBy('name'),
    [projectId, characterId],
  );

  const [views, setViews] = useState<CharacterRelationshipView[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [type, setType] = useState<RelationshipType>('amigo');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);
  const [relToDelete, setRelToDelete] = useState<CharacterRelationship | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCharacterRelationships(db, characterId).then((result) => {
      if (!cancelled) setViews(result);
    });
    return () => {
      cancelled = true;
    };
  }, [characterId, refreshKey]);

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      await tables(db).characterRelationships.add({
        id: newId(),
        projectId,
        fromId: characterId,
        toId: selectedId,
        type,
        label: label.trim() || undefined,
        description: description.trim() || undefined,
      });
      setSelectedId('');
      setType('amigo');
      setLabel('');
      setDescription('');
      setRefreshKey((k) => k + 1);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (rel: CharacterRelationship) => {
    await tables(db).characterRelationships.delete(rel.id);
    setRelToDelete(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rel-character">Personaje</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="rel-character">
                  <SelectValue placeholder="Elige otro personaje del proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {(others ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-type">Tipo de relación</Label>
              <Select value={type} onValueChange={(v) => setType(v as RelationshipType)}>
                <SelectTrigger id="rel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rel-label">Etiqueta (opcional)</Label>
              <Input
                id="rel-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="p. ej. hermano mayor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-description">Descripción (opcional)</Label>
              <Textarea
                id="rel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cómo se relacionan…"
                rows={1}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleAdd()} disabled={!selectedId || adding}>
              <Users className="mr-2 h-4 w-4" />
              {adding ? 'Añadiendo…' : 'Añadir relación'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este personaje aún no tiene relaciones con otros personajes del proyecto.
        </p>
      ) : (
        <ul className="space-y-2">
          {views.map((view) => (
            <li
              key={view.relationship.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{view.sentence}</p>
                <p className="text-xs text-muted-foreground">
                  {view.inverseSentence}
                  {view.relationship.label ? ` · «${view.relationship.label}»` : ''}
                </p>
                {view.relationship.description && (
                  <p className="text-xs text-muted-foreground">
                    {view.relationship.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={view.direction === 'saliente' ? 'default' : 'secondary'}>
                  {view.direction === 'saliente' ? 'Saliente' : 'Entrante'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRelToDelete(view.relationship)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={relToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRelToDelete(null);
        }}
        title="Eliminar relación"
        message="La relación dejará de aparecer en ambos personajes."
        onConfirm={() => {
          if (relToDelete) void handleDelete(relToDelete);
        }}
      />
    </div>
  );
}
