import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { db } from '../db/db';
import {
  deleteCharacterCascade,
  duplicateCharacter,
  tables,
  type Character,
} from '../lib/characters';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select';
import { CharacterCard } from '../components/characters/CharacterCard';
import { CharacterDetail } from '../components/characters/CharacterDetail';
import { CharacterForm } from '../components/characters/CharacterForm';

export function Characters() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  const characters = useLiveQuery(
    () =>
      activeProjectId
        ? tables(db).characters.where('projectId').equals(activeProjectId).sortBy('name')
        : Promise.resolve([] as Character[]),
    [activeProjectId],
  );

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);

  const roles = useMemo(() => {
    const set = new Set((characters ?? []).map((c) => c.role).filter(Boolean));
    return [...set].sort();
  }, [characters]);

  const filtered = useMemo(() => {
    const list = characters ?? [];
    const query = search.trim().toLowerCase();
    return list.filter((c) => {
      const matchesSearch = !query || c.name.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'todos' || c.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [characters, search, roleFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (character: Character) => {
    setEditing(character);
    setFormOpen(true);
  };

  const handleDuplicate = async (character: Character) => {
    await duplicateCharacter(db, character.id);
  };

  const handleDelete = async (character: Character) => {
    await deleteCharacterCascade(db, character.id);
    setCharacterToDelete(null);
    if (selectedId === character.id) setSelectedId(null);
  };

  const handleSaved = (id: string) => {
    setSelectedId(id);
  };

  if (!activeProjectId) {
    return (
      <EmptyState
        title="No hay proyecto activo"
        description="Selecciona o crea un proyecto para ver y gestionar sus personajes."
      />
    );
  }

  // Vista detalle
  if (selectedId) {
    return (
      <div className="space-y-6 p-6">
        <CharacterDetail
          characterId={selectedId}
          onBack={() => setSelectedId(null)}
          onEdit={openEdit}
          onDeleted={() => setSelectedId(null)}
        />
        <CharacterForm
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={activeProjectId}
          character={editing}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Personajes</h1>
          <p className="text-sm text-muted-foreground">
            {characters === undefined
              ? 'Cargando…'
              : `${characters.length} ${characters.length === 1 ? 'personaje' : 'personajes'} en este proyecto`}
          </p>
        </div>
        <div className="flex-1" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo personaje
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {characters === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando personajes…</p>
      ) : characters.length === 0 ? (
        <EmptyState
          title="Aún no hay personajes en este proyecto"
          description="Crea el primer personaje para empezar a construir el reparto."
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo personaje
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ningún personaje coincide con la búsqueda o el filtro aplicado."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              onSelect={(c) => setSelectedId(c.id)}
              onDuplicate={(c) => void handleDuplicate(c)}
              onDelete={setCharacterToDelete}
            />
          ))}
        </div>
      )}

      <CharacterForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={activeProjectId}
        character={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={characterToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCharacterToDelete(null);
        }}
        title={
          characterToDelete ? `Eliminar a ${characterToDelete.name}` : 'Eliminar personaje'
        }
        message="Se eliminará el personaje con su galería, sus vestimentas y sus relaciones. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (characterToDelete) void handleDelete(characterToDelete);
        }}
      />
    </div>
  );
}
