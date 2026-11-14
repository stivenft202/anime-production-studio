import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import {
  createScene,
  nextSceneNumber,
  updateScene,
  type Scene,
  type SceneInput,
} from '../../lib/scripts'
import { Button } from '../ui/Button'
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
import { Textarea } from '../ui/Textarea'
import { CharacterMultiSelect, ImagePicker } from '../lore/LoreFormFields'
import { PromptSelect } from './ScriptFields'

const EMPTY_FORM: SceneInput = {
  number: 1,
  title: '',
  locationName: '',
  description: '',
  timeOfDay: '',
  characterIds: [],
  imageAssetIds: [],
  promptIds: [],
}

interface SceneFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  episodeId: string
  /** Si se pasa, el formulario edita; si no, crea una escena nueva. */
  scene?: Scene | null
  onSaved?: (id: string) => void
}

export function SceneForm({ open, onOpenChange, projectId, episodeId, scene, onSaved }: SceneFormProps) {
  const [form, setForm] = useState<SceneInput>(EMPTY_FORM)
  const [numberError, setNumberError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (scene) {
      setForm({
        number: scene.number,
        title: scene.title,
        locationName: scene.locationName,
        description: scene.description,
        timeOfDay: scene.timeOfDay,
        characterIds: scene.characterIds,
        imageAssetIds: scene.imageAssetIds,
        promptIds: scene.promptIds,
      })
    } else {
      setForm(EMPTY_FORM)
      void nextSceneNumber(db, episodeId).then((n) =>
        setForm((prev) => ({ ...prev, number: n })),
      )
    }
    setNumberError(null)
  }, [open, scene, episodeId])

  const set = <K extends keyof SceneInput>(key: K, value: SceneInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!Number.isInteger(form.number) || form.number < 1) {
      setNumberError('El número de escena debe ser un entero mayor que 0.')
      return
    }
    setNumberError(null)
    setSaving(true)
    try {
      const payload: SceneInput = {
        ...form,
        title: form.title.trim(),
        locationName: form.locationName.trim(),
        description: form.description.trim(),
        timeOfDay: form.timeOfDay.trim(),
      }
      if (scene) {
        await updateScene(db, scene.id, payload)
        onSaved?.(scene.id)
      } else {
        const id = await createScene(db, projectId, episodeId, payload)
        onSaved?.(id)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scene ? 'Editar escena' : 'Nueva escena'}</DialogTitle>
          <DialogDescription>
            Una escena es un bloque del episodio en un lugar y un momento
            concretos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scene-number">Número *</Label>
              <Input
                id="scene-number"
                type="number"
                min={1}
                step={1}
                value={form.number}
                onChange={(e) => set('number', Number(e.target.value))}
              />
              {numberError && <p className="text-xs text-destructive">{numberError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-time">Momento temporal</Label>
              <Input
                id="scene-time"
                value={form.timeOfDay}
                onChange={(e) => set('timeOfDay', e.target.value)}
                placeholder="Noche, amanecer, tarde…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scene-title">Título</Label>
            <Input
              id="scene-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="p. ej. Puente colgante y murciélagos"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scene-location">Ubicación (nombre del lugar)</Label>
            <Input
              id="scene-location"
              value={form.locationName}
              onChange={(e) => set('locationName', e.target.value)}
              placeholder="Bosque, Puerto Bruma, Mercado…"
            />
            <p className="text-xs text-muted-foreground">
              Los lugares detallados llegan en la fase 5; por ahora se guarda
              el nombre.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scene-description">Descripción</Label>
            <Textarea
              id="scene-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Qué ocurre en la escena."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Personajes presentes</Label>
            <CharacterMultiSelect
              projectId={projectId}
              value={form.characterIds}
              onChange={(ids) => set('characterIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prompts asociados</Label>
            <PromptSelect
              projectId={projectId}
              multiple
              value={form.promptIds}
              onChange={(v) => set('promptIds', Array.isArray(v) ? v : [])}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imágenes de referencia</Label>
            <ImagePicker
              projectId={projectId}
              value={form.imageAssetIds}
              onChange={(ids) => set('imageAssetIds', ids)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : scene ? 'Guardar cambios' : 'Crear escena'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
