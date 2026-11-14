import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import {
  createTimelineEvent,
  updateTimelineEvent,
  type TimelineEvent,
  type TimelineEventInput,
} from '../../lib/lore'
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
import { Switch } from '../ui/Switch'
import { Textarea } from '../ui/Textarea'
import {
  CharacterMultiSelect,
  ImagePicker,
  LocationNamesInput,
} from './LoreFormFields'

const EMPTY_FORM: TimelineEventInput = {
  title: '',
  fictionalDate: '',
  era: '',
  description: '',
  consequences: '',
  spoiler: false,
  characterIds: [],
  locationNames: [],
  imageAssetIds: [],
}

interface TimelineEventFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Si se pasa, el formulario edita; si no, crea un acontecimiento nuevo. */
  event?: TimelineEvent | null
  onSaved?: (id: string) => void
}

export function TimelineEventForm({ open, onOpenChange, projectId, event, onSaved }: TimelineEventFormProps) {
  const [form, setForm] = useState<TimelineEventInput>(EMPTY_FORM)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (event) {
      setForm({
        title: event.title,
        fictionalDate: event.fictionalDate,
        era: event.era,
        description: event.description,
        consequences: event.consequences,
        spoiler: event.spoiler,
        characterIds: event.characterIds,
        locationNames: event.locationNames,
        imageAssetIds: event.imageAssetIds,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setTitleError(null)
  }, [open, event])

  const set = <K extends keyof TimelineEventInput>(key: K, value: TimelineEventInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setTitleError('El título es obligatorio.')
      return
    }
    setTitleError(null)
    setSaving(true)
    try {
      const payload: TimelineEventInput = { ...form, title: form.title.trim() }
      if (event) {
        await updateTimelineEvent(db, event.id, payload)
        onSaved?.(event.id)
      } else {
        const id = await createTimelineEvent(db, projectId, payload)
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
          <DialogTitle>
            {event ? 'Editar acontecimiento' : 'Nuevo acontecimiento'}
          </DialogTitle>
          <DialogDescription>
            Un suceso de la cronología del universo. El orden en la línea
            temporal se cambia con los botones de subir y bajar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Título *</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="p. ej. La caída de la Ciudad Central"
            />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Fecha ficticia</Label>
              <Input
                id="event-date"
                value={form.fictionalDate}
                onChange={(e) => set('fictionalDate', e.target.value)}
                placeholder="p. ej. Año 214 del Calendario Nuevo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-era">Era</Label>
              <Input
                id="event-era"
                value={form.era}
                onChange={(e) => set('era', e.target.value)}
                placeholder="p. ej. Era del Vacío"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Descripción</Label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Qué ocurrió y cómo."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-consequences">Consecuencias</Label>
            <Textarea
              id="event-consequences"
              value={form.consequences}
              onChange={(e) => set('consequences', e.target.value)}
              placeholder="Qué cambió en el mundo a partir de este suceso."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="event-spoiler"
              checked={form.spoiler}
              onCheckedChange={(checked) => set('spoiler', checked)}
            />
            <Label htmlFor="event-spoiler">Contiene spoilers</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Personajes relacionados</Label>
            <CharacterMultiSelect
              projectId={projectId}
              value={form.characterIds}
              onChange={(ids) => set('characterIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Lugares</Label>
            <LocationNamesInput
              value={form.locationNames}
              onChange={(names) => set('locationNames', names)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imágenes</Label>
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
            {saving ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear acontecimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
