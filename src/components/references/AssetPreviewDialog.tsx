/**
 * Vista previa y detalle de un archivo de referencia (fase 4).
 *
 * El contenido (imagen, vídeo o audio) SOLO se carga cuando el diálogo
 * se abre: nunca en la rejilla. Las imágenes tienen zoom (+/−/restablecer);
 * los vídeos y audios usan el reproductor nativo; los documentos se
 * muestran con sus metadatos y el botón de descarga.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Download,
  FileText,
  Link2,
  Minus,
  Music,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { db, type Asset } from '../../db/db'
import { getAssetUrl, type AssetRef } from '../../lib/files'
import {
  ASSET_KIND_LABELS,
  ASSET_LINK_TARGET_LABELS,
  assetExtension,
  assetKind,
  deleteAssetLink,
  deleteAssetWithLinks,
  downloadAsset,
  formatAssetDate,
  formatFileSize,
  listAssetLinks,
  resolveLinkTargetName,
  type AssetLink,
} from '../../lib/references'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { TagsInput } from '../lore/LoreFormFields'
import { LinkAssetDialog } from './LinkAssetDialog'

interface AssetPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: Asset | null
  projectId: string
  /** Se llama después de eliminar el archivo, para cerrar la selección. */
  onDeleted?: (assetId: string) => void
}

export function AssetPreviewDialog({
  open,
  onOpenChange,
  asset,
  projectId,
  onDeleted,
}: AssetPreviewDialogProps) {
  const kind = asset ? assetKind(asset) : 'otro'
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // El asset en vivo (por si cambia nombre/etiquetas desde otro sitio).
  const liveAsset = useLiveQuery<Asset | undefined>(
    () =>
      asset
        ? db.assets.get(asset.id)
        : Promise.resolve(undefined as Asset | undefined),
    [asset?.id],
  )

  // Carga bajo demanda: solo al abrir el diálogo y solo para
  // imagen/vídeo/audio. Los documentos nunca cargan su contenido.
  useEffect(() => {
    if (!open || !asset) {
      setMediaUrl(null)
      return
    }
    if (kind === 'documento' || kind === 'otro') {
      setMediaUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void (async () => {
      try {
        const url = await getAssetUrl(asset as unknown as AssetRef)
        if (cancelled) return
        if (url.startsWith('blob:')) objectUrl = url
        setMediaUrl(url)
      } catch {
        if (!cancelled) setMediaUrl(null)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset?.id])

  useEffect(() => {
    if (!open) return
    const current = liveAsset ?? asset
    if (!current) return
    setName(current.name)
    setCategory(current.category ?? '')
    setTags(current.tags ?? [])
    setZoom(1)
    setSavedNote(false)
  }, [open, liveAsset?.id, asset?.id])

  const isDirty = useMemo(() => {
    const current = liveAsset ?? asset
    if (!current) return false
    return (
      name.trim() !== current.name ||
      category.trim() !== (current.category ?? '') ||
      JSON.stringify(tags) !== JSON.stringify(current.tags ?? [])
    )
  }, [name, category, tags, liveAsset, asset])

  const handleSaveMeta = async () => {
    if (!asset || !name.trim()) return
    setSaving(true)
    try {
      await db.assets.update(asset.id, {
        name: name.trim(),
        category: category.trim() || undefined,
        tags,
      })
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!asset) return
    await deleteAssetWithLinks(asset)
    setConfirmDelete(false)
    onOpenChange(false)
    onDeleted?.(asset.id)
  }

  if (!asset) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{asset.name}</DialogTitle>
            <DialogDescription>
              {ASSET_KIND_LABELS[kind]} · {formatFileSize(asset.size)} ·{' '}
              {formatAssetDate(asset.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {/* Vista previa: solo se carga bajo demanda al abrir. */}
          <div className="overflow-hidden rounded-md border bg-muted">
            {kind === 'imagen' && (
              <div className="space-y-2 p-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}
                    disabled={zoom <= 0.25}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-14 text-center text-xs text-muted-foreground">
                    {Math.round(zoom * 100)} %
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
                    disabled={zoom >= 4}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Zoom de la imagen
                  </span>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={asset.name}
                      style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                      className="max-w-none"
                    />
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">
                      Cargando imagen…
                    </p>
                  )}
                </div>
              </div>
            )}
            {kind === 'video' && (
              <div className="p-2">
                {mediaUrl ? (
                  <video src={mediaUrl} controls className="max-h-[55vh] w-full" />
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">Cargando vídeo…</p>
                )}
              </div>
            )}
            {kind === 'audio' && (
              <div className="flex items-center gap-3 p-4">
                <Music className="h-8 w-8 shrink-0 text-muted-foreground" />
                {mediaUrl ? (
                  <audio src={mediaUrl} controls className="w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Cargando audio…</p>
                )}
              </div>
            )}
            {(kind === 'documento' || kind === 'otro') && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                {kind === 'documento' ? (
                  <FileText className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <Play className="h-12 w-12 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  Este tipo de archivo no tiene vista previa en la aplicación.
                  Descárgalo para abrirlo con su programa.
                </p>
                <Button onClick={() => void downloadAsset(asset)}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar archivo
                </Button>
              </div>
            )}
          </div>

          {/* Metadatos */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Nombre visible</Label>
              <Input
                id="asset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Solo cambia el nombre que se muestra; el archivo en disco
                conserva su nombre original.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-category">Categoría</Label>
              <Input
                id="asset-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="p. ej. personaje, escenario, voz…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Etiquetas</Label>
              <TagsInput value={tags} onChange={setTags} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <MetaItem label="Formato" value={assetExtension(asset).toUpperCase() || '—'} />
            <MetaItem label="Tipo MIME" value={asset.mime || '—'} />
            <MetaItem label="Tamaño" value={formatFileSize(asset.size)} />
            <MetaItem
              label="Guardado"
              value={asset.storage === 'disk' ? 'En disco' : 'En la app (web)'}
            />
          </dl>

          {isDirty && (
            <div className="flex items-center gap-2">
              <Button onClick={() => void handleSaveMeta()} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              {savedNote && <span className="text-sm text-green-600">Guardado.</span>}
            </div>
          )}

          {/* Enlaces a otros elementos */}
          <AssetLinksSection
            asset={asset}
            onAddLink={() => setLinkDialogOpen(true)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => void downloadAsset(asset)}>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkAssetDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        asset={asset}
        projectId={projectId}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Eliminar «${asset.name}»`}
        message="El archivo y todos sus enlaces se eliminarán del proyecto. Esta acción no se puede deshacer."
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate" title={value}>
        {value}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Enlaces del archivo                                                 */
/* ------------------------------------------------------------------ */

function AssetLinksSection({
  asset,
  onAddLink,
}: {
  asset: Asset
  onAddLink: () => void
}) {
  const links = useLiveQuery(() => listAssetLinks(asset.id), [asset.id])
  const [names, setNames] = useState<Record<string, string | null>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const out: Record<string, string | null> = {}
      for (const link of links ?? []) {
        out[link.id] = await resolveLinkTargetName(link)
      }
      if (!cancelled) setNames(out)
    })()
    return () => {
      cancelled = true
    }
  }, [links])

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-sm">
          Enlaces ({links === undefined ? '…' : links.length})
        </p>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onAddLink}>
          <Link2 className="mr-2 h-4 w-4" />
          Enlazar con…
        </Button>
      </div>
      {links === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando enlaces…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este archivo no está enlazado a ningún elemento. Enlázalo con un
          personaje, un episodio, una escena, un plano, un prompt o una
          entrada de lore.
        </p>
      ) : (
        <ul className="space-y-1">
          {links.map((link: AssetLink) => (
            <li
              key={link.id}
              className="flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-sm"
            >
              <span className="font-medium">
                {ASSET_LINK_TARGET_LABELS[link.targetType]}
              </span>
              <span className="flex-1 truncate">
                {link.id in names
                  ? (names[link.id] ?? 'Elemento eliminado')
                  : 'Cargando…'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteAssetLink(link.id)}
                title="Quitar enlace"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Quitar un enlace solo desvincula el archivo; no borra el elemento.
      </p>
    </div>
  )
}
