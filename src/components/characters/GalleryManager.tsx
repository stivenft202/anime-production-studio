import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImagePlus, Star, Trash2, Upload } from 'lucide-react';
import { db } from '../../db/db';
import {
  deleteAssetFileIfUnreferenced,
  IMAGE_CATEGORIES,
  IMAGE_CATEGORY_LABELS,
  newId,
  tables,
  type CharacterImage,
  type ImageCategory,
} from '../../lib/characters';
import { saveAssetFile } from '../../lib/files';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { useAssetUrlMap } from './useAssetUrls';

interface GalleryManagerProps {
  characterId: string;
  projectId: string;
}

export function GalleryManager({ characterId, projectId }: GalleryManagerProps) {
  const images = useLiveQuery(
    () =>
      tables(db).characterImages.where('characterId').equals(characterId).sortBy('sortOrder'),
    [characterId],
  );
  const assetIds = (images ?? []).map((img) => img.assetId);
  const urls = useAssetUrlMap(assetIds);

  const [uploadCategory, setUploadCategory] = useState<ImageCategory>('otro');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<CharacterImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setUploading(true);
    try {
      const baseOrder = images?.length ?? 0;
      for (let i = 0; i < list.length; i++) {
        const saved = (await saveAssetFile(list[i], projectId)) as unknown as {
          id?: string;
          assetId?: string;
        };
        const assetId =
          typeof saved === 'string' ? saved : saved.id ?? saved.assetId;
        if (!assetId) continue;
        const isFirstImage = baseOrder === 0 && i === 0;
        const rowId = newId();
        await tables(db).characterImages.add({
          id: rowId,
          characterId,
          assetId,
          category: uploadCategory,
          isMain: isFirstImage,
          sortOrder: baseOrder + i,
        });
        if (isFirstImage) {
          await tables(db).characters.update(characterId, { mainImageId: rowId });
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSetMain = async (image: CharacterImage) => {
    await db.transaction(
      'rw',
      db.table('characterImages'),
      db.table('characters'),
      async () => {
        const t = tables(db);
        await t.characterImages
          .where('characterId')
          .equals(characterId)
          .modify({ isMain: false });
        await t.characterImages.update(image.id, { isMain: true });
        await t.characters.update(characterId, { mainImageId: image.id });
      },
    );
  };

  const handleDelete = async (image: CharacterImage) => {
    await tables(db).characterImages.delete(image.id);
    await deleteAssetFileIfUnreferenced(db, image.assetId, characterId);
    if (image.isMain) {
      await tables(db).characters.update(characterId, { mainImageId: undefined });
    }
    setImageToDelete(null);
  };

  const handleCategoryChange = async (image: CharacterImage, category: ImageCategory) => {
    await tables(db).characterImages.update(image.id, { category });
  };

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra imágenes aquí o selecciónalas desde tu equipo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Select
            value={uploadCategory}
            onValueChange={(v) => setUploadCategory(v as ImageCategory)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
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
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {!images || images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este personaje aún no tiene imágenes en su galería.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {urls[image.assetId] ? (
                  <img
                    src={urls[image.assetId]}
                    alt={`Imagen de ${IMAGE_CATEGORY_LABELS[image.category]}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {image.isMain && (
                  <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <Select
                  value={image.category}
                  onValueChange={(v) => void handleCategoryChange(image, v as ImageCategory)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  {!image.isMain && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => void handleSetMain(image)}
                    >
                      <Star className="mr-1 h-3.5 w-3.5" />
                      Principal
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className={image.isMain ? 'flex-1' : ''}
                    onClick={() => setImageToDelete(image)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={imageToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null);
        }}
        title="Eliminar imagen"
        message="La imagen se quitará de la galería de este personaje. Si ningún otro personaje la usa, también se borrará el archivo."
        onConfirm={() => {
          if (imageToDelete) void handleDelete(imageToDelete);
        }}
      />
    </div>
  );
}
