import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Download,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  Link2,
  List,
  Music,
  Play,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { db, type Asset } from '../db/db'
import { saveAssetFile } from '../lib/files'
import {
  ASSET_KIND_LABELS,
  assetExtension,
  assetKind,
  deleteAssetWithLinks,
  downloadAsset,
  formatAssetDate,
  formatFileSize,
  listAssetLinks,
  listProjectAssets,
  type AssetKind,
} from '../lib/references'
import { useAppStore } from '../store/appStore'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { AssetPreviewDialog } from '../components/references/AssetPreviewDialog'
import { LinkAssetDialog } from '../components/references/LinkAssetDialog'
import {
  THUMBNAIL_MAX_BYTES,
  useLazyAssetUrl,
} from '../components/references/useLazyAssetUrl'

type ViewMode = 'rejilla' | 'lista'

export function References() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)

  const assets = useLiveQuery(
    () =>
      activeProjectId
        ? listProjectAssets(activeProjectId)
        : Promise.resolve([] as Asset[]),
    [activeProjectId],
  )

  const [viewMode, setViewMode] = useState<ViewMode>('rejilla')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('todos')
  const [categoryFilter, setCategoryFilter] = useState<string>('todos')
  const [tagFilter, setTagFilter] = useState<string>('todos')
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [linkAsset, setLinkAsset] = useState<Asset | null>(null)
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const a of assets ?? []) if (a.category?.trim()) set.add(a.category.trim())
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [assets])

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const a of assets ?? []) for (const t of a.tags ?? []) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [assets])

  const filteredAssets = useMemo(() => {
    const list = assets ?? []
    const query = search.trim().toLowerCase()
    return list
      .filter((a) => {
        const haystack = [a.name, a.mime, a.category ?? '', ...(a.tags ?? [])]
          .join(' ')
          .toLowerCase()
        const matchesSearch = !query || haystack.includes(query)
        const matchesKind = kindFilter === 'todos' || assetKind(a) === kindFilter
        const matchesCategory =
          categoryFilter === 'todos' || (a.category ?? '') === categoryFilter
        const matchesTag = tagFilter === 'todos' || (a.tags ?? []).includes(tagFilter)
        return matchesSearch && matchesKind && matchesCategory && matchesTag
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [assets, search, kindFilter, categoryFilter, tagFilter])

  const handleFiles = async (files: FileList | File[]) => {
    if (!activeProjectId) return
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading((n) => n + list.length)
    try {
      for (const file of list) {
        await saveAssetFile(file, activeProjectId)
        setUploading((n) => Math.max(0, n - 1))
      }
    } finally {
      setUploading(0)
    }
  }

  const openPreview = (asset: Asset) => {
    setSelectedAsset(asset)
    setPreviewOpen(true)
  }

  const handleDelete = async (asset: Asset) => {
    await deleteAssetWithLinks(asset)
    setAssetToDelete(null)
    if (selectedAsset?.id === asset.id) {
      setPreviewOpen(false)
      setSelectedAsset(null)
    }
  }

  if (!activeProjectId) {
    return (
      <EmptyState
        title="No hay proyecto activo"
        description="Selecciona o crea un proyecto para ver y gestionar sus referencias visuales."
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Referencias visuales</h1>
          <p className="text-sm text-muted-foreground">
            {assets === undefined
              ? 'Cargando…'
              : `${assets.length} ${assets.length === 1 ? 'archivo' : 'archivos'} en este proyecto`}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1 rounded-md border p-1">
          <Button
            variant={viewMode === 'rejilla' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('rejilla')}
            title="Vista de rejilla"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'lista' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('lista')}
            title="Vista de lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading > 0}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading > 0 ? `Subiendo ${uploading}…` : 'Subir archivos'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Zona de arrastrar y soltar */}
      <div
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
        }}
      >
        <p className="text-sm text-muted-foreground">
          {dragOver
            ? 'Suelta los archivos para subirlos'
            : 'Arrastra archivos aquí para subirlos, o usa el botón «Subir archivos». Imágenes, vídeos, audios y documentos.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría o etiqueta…"
            className="pl-9"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo de archivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {ASSET_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las etiquetas</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {assets === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando archivos…</p>
      ) : assets.length === 0 ? (
        <EmptyState
          title="Aún no hay archivos en este proyecto"
          description="Sube imágenes, vídeos, audios o documentos para usarlos como referencia en personajes, escenas, prompts y lore."
          action={
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Subir archivos
            </Button>
          }
        />
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ningún archivo coincide con la búsqueda o los filtros aplicados."
        />
      ) : viewMode === 'rejilla' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredAssets.map((asset) => (
            <AssetGridCard
              key={asset.id}
              asset={asset}
              onOpen={() => openPreview(asset)}
              onDownload={() => void downloadAsset(asset)}
              onLink={() => setLinkAsset(asset)}
              onDelete={() => setAssetToDelete(asset)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <AssetListRow
              key={asset.id}
              asset={asset}
              onOpen={() => openPreview(asset)}
              onDownload={() => void downloadAsset(asset)}
              onLink={() => setLinkAsset(asset)}
              onDelete={() => setAssetToDelete(asset)}
            />
          ))}
        </div>
      )}

      <AssetPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        asset={selectedAsset}
        projectId={activeProjectId}
        onDeleted={(id) => {
          if (selectedAsset?.id === id) setSelectedAsset(null)
        }}
      />
      <LinkAssetDialog
        open={linkAsset !== null}
        onOpenChange={(open) => {
          if (!open) setLinkAsset(null)
        }}
        asset={linkAsset}
        projectId={activeProjectId}
      />
      <ConfirmDialog
        open={assetToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setAssetToDelete(null)
        }}
        title={assetToDelete ? `Eliminar «${assetToDelete.name}»` : 'Eliminar archivo'}
        message="El archivo y todos sus enlaces se eliminarán del proyecto. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (assetToDelete) void handleDelete(assetToDelete)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tarjeta de rejilla (miniatura perezosa solo para imágenes pequeñas) */
/* ------------------------------------------------------------------ */

function AssetGridCard({
  asset,
  onOpen,
  onDownload,
  onLink,
  onDelete,
}: {
  asset: Asset
  onOpen: () => void
  onDownload: () => void
  onLink: () => void
  onDelete: () => void
}) {
  const kind = assetKind(asset)
  const showThumbnail = kind === 'imagen' && asset.size <= THUMBNAIL_MAX_BYTES
  const { url, ref } = useLazyAssetUrl(showThumbnail ? asset : null)
  const linkCount = useLiveQuery(() => listAssetLinks(asset.id).then((l) => l.length), [asset.id])

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50">
      <button
        type="button"
        ref={ref as (el: HTMLButtonElement | null) => void}
        onClick={onOpen}
        className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted"
        title={asset.name}
      >
        {showThumbnail && url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-3 text-muted-foreground">
            <KindIcon kind={kind} className="h-10 w-10" />
            <span className="text-xs font-medium">{ASSET_KIND_LABELS[kind]}</span>
            {kind === 'imagen' && !showThumbnail && (
              <span className="text-center text-[11px]">
                Imagen grande ({formatFileSize(asset.size)}) — pulsa para verla
              </span>
            )}
            {kind !== 'imagen' && (
              <span className="text-center text-[11px]">
                {assetExtension(asset).toUpperCase() || 'Archivo'}
              </span>
            )}
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 break-words text-sm font-medium" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(asset.size)} · {formatAssetDate(asset.createdAt)}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{ASSET_KIND_LABELS[kind]}</Badge>
          {asset.category && <Badge variant="outline">{asset.category}</Badge>}
          {(linkCount ?? 0) > 0 && (
            <Badge variant="outline">
              <Link2 className="mr-1 h-3 w-3" />
              {linkCount} {linkCount === 1 ? 'enlace' : 'enlaces'}
            </Badge>
          )}
        </div>
        <div className="mt-auto flex gap-1 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onOpen}>
            Ver
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload} title="Descargar">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={onLink} title="Enlazar con…">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fila de lista                                                       */
/* ------------------------------------------------------------------ */

function AssetListRow({
  asset,
  onOpen,
  onDownload,
  onLink,
  onDelete,
}: {
  asset: Asset
  onOpen: () => void
  onDownload: () => void
  onLink: () => void
  onDelete: () => void
}) {
  const kind = assetKind(asset)
  const linkCount = useLiveQuery(() => listAssetLinks(asset.id).then((l) => l.length), [asset.id])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          <KindIcon kind={kind} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{asset.name}</span>
          <span className="block text-xs text-muted-foreground">
            {ASSET_KIND_LABELS[kind]} · {formatFileSize(asset.size)} ·{' '}
            {formatAssetDate(asset.createdAt)}
            {asset.category ? ` · ${asset.category}` : ''}
            {(linkCount ?? 0) > 0 ? ` · ${linkCount} ${linkCount === 1 ? 'enlace' : 'enlaces'}` : ''}
          </span>
        </span>
      </button>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={onOpen}>
          Ver
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload} title="Descargar">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={onLink} title="Enlazar con…">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete} title="Eliminar">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function KindIcon({ kind, className }: { kind: AssetKind; className?: string }) {
  switch (kind) {
    case 'imagen':
      return <ImageIcon className={className} />
    case 'video':
      return <Play className={className} />
    case 'audio':
      return <Music className={className} />
    case 'documento':
      return <FileText className={className} />
    default:
      return <FileText className={className} />
  }
}
