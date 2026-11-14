/**
 * Selectores del formulario de prompt (fase 4).
 *
 * Episodio / escena / plano se leen de las tablas de la fase 3
 * (`db.episodes`, `db.scenes`, `db.shots`): si aún no hay episodios en
 * el proyecto, el selector lo dice con honestidad y no inventa datos.
 * Las imágenes de referencia y el resultado generado son archivos
 * reales del proyecto (`db.assets`), con subida mediante saveAssetFile.
 */
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { db, type Asset, type Scene, type Shot } from '../../db/db'
import { saveAssetFile } from '../../lib/files'
import { assetKind } from '../../lib/references'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { useAssetUrlMap } from '../characters/useAssetUrls'

/* ------------------------------------------------------------------ */
/* Episodio / escena / plano (datos reales de la fase 3)               */
/* ------------------------------------------------------------------ */

export interface EpisodeSceneShotValue {
  episodeId?: string
  sceneId?: string
  shotId?: string
}

interface EpisodeSceneShotPickerProps {
  projectId: string
  value: EpisodeSceneShotValue
  onChange: (value: EpisodeSceneShotValue) => void
}

export function EpisodeSceneShotPicker({
  projectId,
  value,
  onChange,
}: EpisodeSceneShotPickerProps) {
  const episodes = useLiveQuery(
    () =>
      db.episodes.where('projectId').equals(projectId).sortBy('number'),
    [projectId],
  )
  const scenes = useLiveQuery(
    () =>
      value.episodeId
        ? db.scenes.where('episodeId').equals(value.episodeId).sortBy('number')
        : Promise.resolve([] as Scene[]),
    [value.episodeId],
  )
  const shots = useLiveQuery(
    () =>
      value.sceneId
        ? db.shots.where('sceneId').equals(value.sceneId).sortBy('number')
        : Promise.resolve([] as Shot[]),
    [value.sceneId],
  )

  if (!episodes) {
    return <p className="text-sm text-muted-foreground">Cargando episodios…</p>
  }

  if (episodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este proyecto aún no tiene episodios. Los episodios se crean en el
        módulo Guiones (fase 3); cuando existan, podrás relacionar el
        prompt con un episodio, una escena y un plano.
      </p>
    )
  }

  const selectedEpisode = episodes.find((e) => e.id === value.episodeId)
  const selectedScene = (scenes ?? []).find((s) => s.id === value.sceneId)

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Episodio</Label>
        <Select
          value={value.episodeId ?? 'ninguno'}
          onValueChange={(v) =>
            onChange(
              v === 'ninguno'
                ? {}
                : { episodeId: v, sceneId: undefined, shotId: undefined },
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin episodio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin episodio</SelectItem>
            {episodes.map((ep) => (
              <SelectItem key={ep.id} value={ep.id}>
                Ep. {ep.number}
                {ep.title ? ` — ${ep.title}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Escena</Label>
        <Select
          value={value.sceneId ?? 'ninguna'}
          disabled={!selectedEpisode || (scenes ?? []).length === 0}
          onValueChange={(v) =>
            onChange(
              v === 'ninguna'
                ? { episodeId: value.episodeId }
                : { episodeId: value.episodeId, sceneId: v, shotId: undefined },
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin escena" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguna">Sin escena</SelectItem>
            {(scenes ?? []).map((scene) => (
              <SelectItem key={scene.id} value={scene.id}>
                Escena {scene.number}
                {scene.title ? ` — ${scene.title}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedEpisode && (scenes ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Este episodio aún no tiene escenas.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Plano</Label>
        <Select
          value={value.shotId ?? 'ninguno'}
          disabled={!selectedScene || (shots ?? []).length === 0}
          onValueChange={(v) =>
            onChange(
              v === 'ninguno'
                ? { episodeId: value.episodeId, sceneId: value.sceneId }
                : {
                    episodeId: value.episodeId,
                    sceneId: value.sceneId,
                    shotId: v,
                  },
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ninguno">Sin plano</SelectItem>
            {(shots ?? []).map((shot) => (
              <SelectItem key={shot.id} value={shot.id}>
                Plano {shot.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedScene && (shots ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Esta escena aún no tiene planos.
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Imágenes de referencia (archivos reales del proyecto)               */
/* ------------------------------------------------------------------ */

interface ReferenceImagesPickerProps {
  projectId: string
  value: string[]
  onChange: (assetIds: string[]) => void
}

export function ReferenceImagesPicker({
  projectId,
  value,
  onChange,
}: ReferenceImagesPickerProps) {
  const urls = useAssetUrlMap(value)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const images = useLiveQuery(
    () =>
      db.assets
        .where('projectId')
        .equals(projectId)
        .filter((a) => assetKind(a) === 'imagen')
        .sortBy('name'),
    [projectId],
  )

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

  const available = (images ?? []).filter((a) => !value.includes(a.id))

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
        {available.length > 0 && (
          <Select
            value=""
            onValueChange={(id) => onChange([...value, id])}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Añadir imagen existente…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((a: Asset) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">
          {value.length === 0
            ? 'Sin imágenes de referencia.'
            : `${value.length} ${value.length === 1 ? 'imagen' : 'imágenes'}.`}
        </span>
      </div>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((assetId) => (
            <div
              key={assetId}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {urls[assetId] ? (
                <img
                  src={urls[assetId]}
                  alt="Imagen de referencia"
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
        Al quitar una imagen solo se desvincula de este prompt; el archivo
        sigue en el proyecto.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resultado generado (un solo archivo: imagen o vídeo)                */
/* ------------------------------------------------------------------ */

interface GeneratedResultPickerProps {
  projectId: string
  value?: string
  onChange: (assetId: string | undefined) => void
}

export function GeneratedResultPicker({
  projectId,
  value,
  onChange,
}: GeneratedResultPickerProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const media = useLiveQuery(
    () =>
      db.assets
        .where('projectId')
        .equals(projectId)
        .filter((a) => {
          const kind = assetKind(a)
          return kind === 'imagen' || kind === 'video'
        })
        .sortBy('name'),
    [projectId],
  )

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const kind = assetKind({ mime: file.type, name: file.name })
    if (kind !== 'imagen' && kind !== 'video') return
    setUploading(true)
    try {
      const saved = await saveAssetFile(file, projectId)
      onChange(saved.id)
    } finally {
      setUploading(false)
    }
  }

  const selected = (media ?? []).find((a) => a.id === value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value ?? 'ninguno'}
        onValueChange={(v) => onChange(v === 'ninguno' ? undefined : v)}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Sin resultado generado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ninguno">Sin resultado generado</SelectItem>
          {(media ?? []).map((a: Asset) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Subiendo…' : 'Subir resultado'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files)
          e.target.value = ''
        }}
      />
      {selected && (
        <span className="text-xs text-muted-foreground">
          Seleccionado: {selected.name}
        </span>
      )}
    </div>
  )
}
