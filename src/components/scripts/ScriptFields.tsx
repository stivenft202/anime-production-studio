/**
 * Campos compartidos de los formularios de Guiones (fase 3).
 *
 * - Selector de prompts (reales, de la tabla `prompts`): si aún no hay
 *   prompts, se dice que llegan en la fase 4; NO se inventa ninguno.
 * - Portada del episodio (una imagen, subida real con `saveAssetFile`).
 * - Archivo asociado genérico (vídeo generado de un plano, audio de un
 *   diálogo): subida real, se guarda el asset y se muestra su nombre.
 */
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileAudio, FileVideo, ImagePlus, Trash2, Upload, X } from 'lucide-react'
import { db, type Asset } from '../../db/db'
import { saveAssetFile } from '../../lib/files'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { useAssetUrl, useAssetUrlMap } from '../characters/useAssetUrls'

/* ------------------------------------------------------------------ */
/* Prompts (tabla `prompts`, fase 4)                                   */
/* ------------------------------------------------------------------ */

interface PromptSelectProps {
  projectId: string
  /** Un solo prompt (plano) o varios (escena). */
  value: string | string[]
  multiple?: boolean
  onChange: (value: string | string[]) => void
}

export function PromptSelect({ projectId, value, multiple, onChange }: PromptSelectProps) {
  const prompts = useLiveQuery(
    () => db.prompts.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )

  if (!prompts) {
    return <p className="text-sm text-muted-foreground">Cargando prompts…</p>
  }

  if (prompts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay prompts en este proyecto. La biblioteca de prompts
        llega en la fase 4.
      </p>
    )
  }

  if (multiple) {
    const selected = Array.isArray(value) ? value : []
    const toggle = (id: string) => {
      onChange(
        selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id],
      )
    }
    return (
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
        {prompts.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
              className="size-4 accent-primary"
            />
            <span className="font-medium">{p.name}</span>
            {p.category && (
              <span className="text-xs text-muted-foreground">· {p.category}</span>
            )}
          </label>
        ))}
      </div>
    )
  }

  const selected = typeof value === 'string' ? value : ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value || '')}
        className="h-10 min-w-52 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Sin prompt</option>
        {prompts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.aiModel ? ` — ${p.aiModel}` : ''}
          </option>
        ))}
      </select>
      {selected && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
          <X className="h-3.5 w-3.5" />
          Quitar
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Portada del episodio (una imagen)                                   */
/* ------------------------------------------------------------------ */

interface CoverPickerProps {
  projectId: string
  value?: string
  onChange: (assetId: string | undefined) => void
}

export function CoverPicker({ projectId, value, onChange }: CoverPickerProps) {
  const url = useAssetUrl(value)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const saved = await saveAssetFile(file, projectId)
      onChange(saved.id)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Subiendo…' : value ? 'Cambiar portada' : 'Subir portada'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) void handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Quitar
          </Button>
        )}
      </div>
      {url && (
        <div className="aspect-video w-64 overflow-hidden rounded-md border bg-muted">
          <img src={url} alt="Portada del episodio" className="h-full w-full object-cover" />
        </div>
      )}
      {!value && (
        <p className="text-xs text-muted-foreground">Sin portada todavía.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Archivo asociado (vídeo o audio)                                    */
/* ------------------------------------------------------------------ */

interface AssetFilePickerProps {
  projectId: string
  value?: string
  /** 'video' para el vídeo generado de un plano, 'audio' para un diálogo. */
  kind: 'video' | 'audio'
  onChange: (assetId: string | undefined) => void
}

export function AssetFilePicker({ projectId, value, kind, onChange }: AssetFilePickerProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const asset = useLiveQuery<Asset | undefined>(
    () => (value ? db.assets.get(value) : Promise.resolve(undefined)),
    [value],
  )
  const urls = useAssetUrlMap(value ? [value] : [])

  const accept = kind === 'video' ? 'video/*' : 'audio/*'
  const Icon = kind === 'video' ? FileVideo : FileAudio
  const label = kind === 'video' ? 'vídeo generado' : 'audio'

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const saved = await saveAssetFile(file, projectId)
      onChange(saved.id)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Subiendo…' : value ? `Cambiar ${label}` : `Subir ${label}`}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) void handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Quitar
          </Button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {asset?.name ?? 'Archivo asociado'}
            {asset?.size ? ` · ${(asset.size / 1024 / 1024).toFixed(1)} MB` : ''}
          </span>
          {urls[value] &&
            (kind === 'video' ? (
              <video src={urls[value]} controls className="max-h-24 max-w-48 rounded" />
            ) : (
              <audio src={urls[value]} controls className="max-w-64" />
            ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {value
          ? 'El archivo queda guardado en el proyecto.'
          : `Sin ${label} asociado todavía.`}
      </p>
    </div>
  )
}

/** Etiqueta pequeña reutilizable para los formularios de guiones. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-sm font-medium">{children}</Label>
}
