import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImagePlus, Pencil, Shirt, Star, Trash2, X } from 'lucide-react';
import { db } from '../../db/db';
import {
  deleteAssetFileIfUnreferenced,
  newId,
  tables,
  type CharacterOutfit,
} from '../../lib/characters';
import { saveAssetFile } from '../../lib/files';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { useAssetUrlMap } from './useAssetUrls';

interface OutfitManagerProps {
  characterId: string;
  projectId: string;
}

interface OutfitFormState {
  name: string;
  description: string;
  imageIds: string[];
}

const EMPTY_OUTFIT: OutfitFormState = { name: '', description: '', imageIds: [] };

export function OutfitManager({ characterId, projectId }: OutfitManagerProps) {
  const outfits = useLiveQuery(
    () => tables(db).characterOutfits.where('characterId').equals(characterId).toArray(),
    [characterId],
  );
  const allImageIds = (outfits ?? []).flatMap((o) => o.imageIds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterOutfit | null>(null);
  // Se incluyen también las imágenes del formulario (aún sin guardar) para
  // mostrar sus miniaturas mientras se edita.
  const [form, setForm] = useState<OutfitFormState>(EMPTY_OUTFIT);
  const urls = useAssetUrlMap([...allImageIds, ...form.imageIds]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [outfitToDelete, setOutfitToDelete] = useState<CharacterOutfit | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_OUTFIT);
    setNameError(null);
    setDialogOpen(true);
  };

  const openEdit = (outfit: CharacterOutfit) => {
    setEditing(outfit);
    setForm({
      name: outfit.name,
      description: outfit.description,
      imageIds: [...outfit.imageIds],
    });
    setNameError(null);
    setDialogOpen(true);
  };

  const handleUploadImages = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setUploading(true);
    try {
      const newIds: string[] = [];
      for (const file of list) {
        const saved = (await saveAssetFile(file, projectId)) as unknown as {
          id?: string;
          assetId?: string;
        };
        const assetId = typeof saved === 'string' ? saved : saved.id ?? saved.assetId;
        if (assetId) newIds.push(assetId);
      }
      if (newIds.length > 0) {
        setForm((prev) => ({ ...prev, imageIds: [...prev.imageIds, ...newIds] }));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFormImage = (assetId: string) => {
    setForm((prev) => ({ ...prev, imageIds: prev.imageIds.filter((id) => id !== assetId) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('El nombre de la vestimenta es obligatorio.');
      return;
    }
    setNameError(null);
    if (editing) {
      const removed = editing.imageIds.filter((id) => !form.imageIds.includes(id));
      await tables(db).characterOutfits.update(editing.id, {
        name: form.name.trim(),
        description: form.description,
        imageIds: form.imageIds,
      });
      for (const assetId of removed) {
        await deleteAssetFileIfUnreferenced(db, assetId, characterId);
      }
    } else {
      await tables(db).characterOutfits.add({
        id: newId(),
        characterId,
        name: form.name.trim(),
        description: form.description,
        imageIds: form.imageIds,
        isDefault: (outfits?.length ?? 0) === 0,
      });
    }
    setDialogOpen(false);
  };

  const handleSetDefault = async (outfit: CharacterOutfit) => {
    await db.transaction('rw', db.table('characterOutfits'), async () => {
      const t = tables(db);
      await t.characterOutfits.where('characterId').equals(characterId).modify({ isDefault: false });
      await t.characterOutfits.update(outfit.id, { isDefault: true });
    });
  };

  const handleDelete = async (outfit: CharacterOutfit) => {
    await tables(db).characterOutfits.delete(outfit.id);
    for (const assetId of outfit.imageIds) {
      await deleteAssetFileIfUnreferenced(db, assetId, characterId);
    }
    setOutfitToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Shirt className="mr-2 h-4 w-4" />
          Nueva vestimenta
        </Button>
      </div>

      {!outfits || outfits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este personaje aún no tiene vestimentas registradas.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {outfits.map((outfit) => (
            <Card key={outfit.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{outfit.name}</CardTitle>
                {outfit.isDefault && <Badge>Predeterminada</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                {outfit.description && (
                  <p className="text-sm text-muted-foreground">{outfit.description}</p>
                )}
                {outfit.imageIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {outfit.imageIds.map((assetId) =>
                      urls[assetId] ? (
                        <img
                          key={assetId}
                          src={urls[assetId]}
                          alt={outfit.name}
                          className="h-20 w-20 rounded object-cover"
                        />
                      ) : (
                        <div
                          key={assetId}
                          className="flex h-20 w-20 items-center justify-center rounded bg-muted"
                        >
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ),
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(outfit)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  {!outfit.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => void handleSetDefault(outfit)}>
                      <Star className="mr-1 h-3.5 w-3.5" />
                      Predeterminada
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setOutfitToDelete(outfit)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar: ${editing.name}` : 'Nueva vestimenta'}</DialogTitle>
            <DialogDescription>
              Una vestimenta es un conjunto de ropa del personaje, con sus imágenes de
              referencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="outfit-name">Nombre *</Label>
              <Input
                id="outfit-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Armadura oscura con capa"
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outfit-description">Descripción</Label>
              <Textarea
                id="outfit-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Cuándo la usa, de qué está hecha…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Imágenes</Label>
              {form.imageIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.imageIds.map((assetId) => (
                    <div key={assetId} className="relative h-20 w-20">
                      {urls[assetId] ? (
                        <img
                          src={urls[assetId]}
                          alt=""
                          className="h-20 w-20 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded bg-muted">
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        onClick={() => handleRemoveFormImage(assetId)}
                        aria-label="Quitar imagen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {uploading ? 'Subiendo…' : 'Subir imágenes'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void handleUploadImages(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={outfitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setOutfitToDelete(null);
        }}
        title="Eliminar vestimenta"
        message="La vestimenta se eliminará de este personaje. Sus imágenes se borrarán solo si ningún otro personaje las usa."
        onConfirm={() => {
          if (outfitToDelete) void handleDelete(outfitToDelete);
        }}
      />
    </div>
  );
}
