import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import {
  createLoreEntry,
  LORE_ENTRY_TYPES,
  updateLoreEntry,
  type LoreEntry,
  type LoreEntryInput,
  type LoreEntryType,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Textarea } from '../ui/Textarea'
import {
  CharacterMultiSelect,
  EpisodeNumbersPicker,
  ImagePicker,
  LocationNamesInput,
  TagsInput,
} from './LoreFormFields'

const EMPTY_FORM: LoreEntryInput = {
  title: '',
  type: 'concepto',
  description: '',
  history: '',
  features: '',
  rules: '',
  tags: [],
  spoiler: false,
  characterIds: [],
  locationNames: [],
  episodeNumbers: [],
  imageAssetIds: [],
}

interface LoreEntryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Si se pasa, el formulario edita; si no, crea una entrada nueva. */
  entry?: LoreEntry | null
  onSaved?: (id: string) => void
}

export function LoreEntryForm({ open, onOpenChange, projectId, entry, onSaved }: LoreEntryFormProps) {
  const [form, setForm] = useState<LoreEntryInput>(EMPTY_FORM)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setForm({
        title: entry.title,
        type: entry.type,
        description: entry.description,
        history: entry.history,
        features: entry.features,
        rules: entry.rules,
        tags: entry.tags,
        spoiler: entry.spoiler,
        characterIds: entry.characterIds,
        locationNames: entry.locationNames,
        episodeNumbers: entry.episodeNumbers,
        imageAssetIds: entry.imageAssetIds,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setTitleError(null)
  }, [open, entry])

  const set = <K extends keyof LoreEntryInput>(key: K, value: LoreEntryInput[K]) => {
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
      const payload: LoreEntryInput = { ...form, title: form.title.trim() }
      if (entry) {
        await updateLoreEntry(db, entry.id, payload)
        onSaved?.(entry.id)
      } else {
        const id = await createLoreEntry(db, projectId, payload)
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
          <DialogTitle>{entry ? 'Editar entrada de lore' : 'Nueva entrada de lore'}</DialogTitle>
          <DialogDescription>
            Describe un elemento del universo: su historia, sus características
            y sus reglas, y relaciónalo con personajes, lugares y episodios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lore-title">Título *</Label>
              <Input
                id="lore-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="p. ej. El Vacío"
              />
              {titleError && <p className="text-xs text-destructive">{titleError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lore-type">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v as LoreEntryType)}>
                <SelectTrigger id="lore-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LORE_ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lore-description">Descripción</Label>
            <Textarea
              id="lore-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Resumen corto: qué es y por qué importa en el mundo."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lore-history">Historia</Label>
            <Textarea
              id="lore-history"
              value={form.history}
              onChange={(e) => set('history', e.target.value)}
              placeholder="Origen, evolución y momentos clave."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lore-features">Características</Label>
            <Textarea
              id="lore-features"
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              placeholder="Rasgos distintivos, apariencia, comportamiento…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lore-rules">Reglas</Label>
            <Textarea
              id="lore-rules"
              value={form.rules}
              onChange={(e) => set('rules', e.target.value)}
              placeholder="Límites, costes, prohibiciones: lo que se puede y no se puede hacer."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Etiquetas</Label>
              <TagsInput value={form.tags} onChange={(tags) => set('tags', tags)} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch
                id="lore-spoiler"
                checked={form.spoiler}
                onCheckedChange={(checked) => set('spoiler', checked)}
              />
              <Label htmlFor="lore-spoiler">Contiene spoilers</Label>
            </div>
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
            <Label>Episodios</Label>
            <EpisodeNumbersPicker
              value={form.episodeNumbers}
              onChange={(numbers) => set('episodeNumbers', numbers)}
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
            {saving ? 'Guardando…' : entry ? 'Guardar cambios' : 'Crear entrada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
