import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { db } from '../../db/db'
import { tables } from '../../lib/characters'
import { saveAssetFile } from '../../lib/files'
import { EPISODE_NUMBERS } from '../../lib/lore'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { useAssetUrlMap } from '../characters/useAssetUrls'

/* ------------------------------------------------------------------ */
/* Selector múltiple de personajes (reales, del proyecto activo)       */
/* ------------------------------------------------------------------ */

interface CharacterMultiSelectProps {
  projectId: string
  value: string[]
  onChange: (ids: string[]) => void
}

export function CharacterMultiSelect({ projectId, value, onChange }: CharacterMultiSelectProps) {
  const characters = useLiveQuery(
    () =>
      tables(db).characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  if (!characters || characters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto aún no tiene personajes. Crea personajes primero para
        relacionarlos con el lore.
      </p>
    )
  }

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
      {characters.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
        >
          <input
            type="checkbox"
            checked={value.includes(c.id)}
            onChange={() => toggle(c.id)}
            className="size-4 accent-primary"
          />
          <span className="font-medium">{c.name}</span>
          {c.role && <span className="text-xs text-muted-foreground">· {c.role}</span>}
        </label>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Lugares (texto libre; el módulo de lugares es la fase 5)            */
/* ------------------------------------------------------------------ */

interface LocationNamesInputProps {
  value: string[]
  onChange: (names: string[]) => void
}

export function LocationNamesInput({ value, onChange }: LocationNamesInputProps) {
  const [text, setText] = useState(value.join(', '))

  return (
    <div className="space-y-1.5">
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(
            e.target.value
              .split(',')
              .map((n) => n.trim())
              .filter(Boolean),
          )
        }}
        placeholder="Ciudad Central, Bosque de las Cenizas… (separados por comas)"
      />
      <p className="text-xs text-muted-foreground">
        Los lugares detallados llegan en la fase 5; por ahora se guardan como
        nombres de texto.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Episodios (números 1-9 del guion; el módulo es la fase 3)           */
/* ------------------------------------------------------------------ */

interface EpisodeNumbersPickerProps {
  value: number[]
  onChange: (numbers: number[]) => void
}

export function EpisodeNumbersPicker({ value, onChange }: EpisodeNumbersPickerProps) {
  const toggle = (n: number) => {
    onChange(
      value.includes(n)
        ? value.filter((v) => v !== n).sort((a, b) => a - b)
        : [...value, n].sort((a, b) => a - b),
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {EPISODE_NUMBERS.map((n) => (
          <Button
            key={n}
            type="button"
            variant={value.includes(n) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggle(n)}
          >
            Ep. {n}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Se guardan los números de episodio del guion (1-9); el módulo de
        Guiones muestra el episodio real con su título.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Imágenes (subida real con saveAssetFile)                            */
/* ------------------------------------------------------------------ */

interface ImagePickerProps {
  projectId: string
  value: string[]
  onChange: (assetIds: string[]) => void
}

export function ImagePicker({ projectId, value, onChange }: ImagePickerProps) {
  const urls = useAssetUrlMap(value)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return
    setUploading(true)
    try {
      const savedIds: string[] = []
      for (const file of list) {
        const saved = await saveAssetFile(file, projectId)
        savedIds.push(saved.id)
      }
      onChange([...value, ...savedIds])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Subiendo…' : 'Subir imágenes'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="text-xs text-muted-foreground">
          {value.length === 0
            ? 'Sin imágenes todavía.'
            : `${value.length} ${value.length === 1 ? 'imagen' : 'imágenes'} asociadas.`}
        </span>
      </div>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((assetId) => (
            <div key={assetId} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
              {urls[assetId] ? (
                <img
                  src={urls[assetId]}
                  alt="Imagen del lore"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                title="Quitar imagen"
                onClick={() => onChange(value.filter((id) => id !== assetId))}
                className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Al quitar una imagen solo se desvincula de esta entrada; el archivo
        sigue en el proyecto.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Etiquetas (texto separado por comas)                                */
/* ------------------------------------------------------------------ */

interface TagsInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagsInput({ value, onChange }: TagsInputProps) {
  return (
    <Input
      value={value.join(', ')}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        )
      }
      placeholder="mundo, magia, guerra… (separadas por comas)"
    />
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-sm font-medium">{children}</Label>
}
