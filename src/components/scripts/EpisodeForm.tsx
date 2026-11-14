import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import {
  createEpisode,
  EPISODE_STATUSES,
  nextEpisodeNumber,
  updateEpisode,
  type Episode,
  type EpisodeInput,
  type EpisodeStatus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { CharacterMultiSelect, LocationNamesInput } from '../lore/LoreFormFields'
import { CoverPicker } from './ScriptFields'

const EMPTY_FORM: EpisodeInput = {
  number: 1,
  title: '',
  synopsis: '',
  status: 'borrador',
  language: 'español',
  characterIds: [],
  placeNames: [],
}

interface EpisodeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Si se pasa, el formulario edita; si no, crea un episodio nuevo. */
  episode?: Episode | null
  onSaved?: (id: string) => void
}

export function EpisodeForm({ open, onOpenChange, projectId, episode, onSaved }: EpisodeFormProps) {
  const [form, setForm] = useState<EpisodeInput>(EMPTY_FORM)
  const [seasonText, setSeasonText] = useState('')
  const [durationText, setDurationText] = useState('')
  const [numberError, setNumberError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (episode) {
      setForm({
        seasonNumber: episode.seasonNumber,
        number: episode.number,
        title: episode.title,
        synopsis: episode.synopsis,
        status: episode.status,
        durationSeconds: episode.durationSeconds,
        language: episode.language,
        coverAssetId: episode.coverAssetId,
        characterIds: episode.characterIds,
        placeNames: episode.placeNames,
      })
      setSeasonText(episode.seasonNumber === undefined ? '' : String(episode.seasonNumber))
      setDurationText(
        episode.durationSeconds === undefined
          ? ''
          : String(Math.round(episode.durationSeconds / 60)),
      )
    } else {
      setForm(EMPTY_FORM)
      setSeasonText('')
      setDurationText('')
      void nextEpisodeNumber(db, projectId).then((n) =>
        setForm((prev) => ({ ...prev, number: n })),
      )
    }
    setNumberError(null)
  }, [open, episode, projectId])

  const set = <K extends keyof EpisodeInput>(key: K, value: EpisodeInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!Number.isInteger(form.number) || form.number < 1) {
      setNumberError('El número de episodio debe ser un entero mayor que 0.')
      return
    }
    setNumberError(null)
    setSaving(true)
    try {
      const season = seasonText.trim() === '' ? undefined : Number(seasonText)
      const durationMinutes = durationText.trim() === '' ? undefined : Number(durationText)
      const payload: EpisodeInput = {
        ...form,
        title: form.title.trim(),
        synopsis: form.synopsis.trim(),
        seasonNumber:
          season === undefined || Number.isNaN(season) || season < 1 ? undefined : Math.floor(season),
        durationSeconds:
          durationMinutes === undefined || Number.isNaN(durationMinutes) || durationMinutes <= 0
            ? undefined
            : Math.round(durationMinutes * 60),
      }
      if (episode) {
        await updateEpisode(db, episode.id, payload)
        onSaved?.(episode.id)
      } else {
        const id = await createEpisode(db, projectId, payload)
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
          <DialogTitle>{episode ? 'Editar episodio' : 'Nuevo episodio'}</DialogTitle>
          <DialogDescription>
            Datos del episodio. El guion se escribe aparte, en el editor de
            la ficha del episodio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-number">Número *</Label>
              <Input
                id="ep-number"
                type="number"
                min={1}
                step={1}
                value={form.number}
                onChange={(e) => set('number', Number(e.target.value))}
              />
              {numberError && <p className="text-xs text-destructive">{numberError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-season">Temporada (opcional)</Label>
              <Input
                id="ep-season"
                type="number"
                min={1}
                step={1}
                value={seasonText}
                onChange={(e) => setSeasonText(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-status">Estado de escritura</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v as EpisodeStatus)}
              >
                <SelectTrigger id="ep-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EPISODE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-title">Título</Label>
            <Input
              id="ep-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Título del episodio (opcional)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-synopsis">Sinopsis</Label>
            <Textarea
              id="ep-synopsis"
              value={form.synopsis}
              onChange={(e) => set('synopsis', e.target.value)}
              placeholder="Resumen del episodio."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ep-duration">Duración estimada (minutos)</Label>
              <Input
                id="ep-duration"
                type="number"
                min={0}
                step={1}
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-language">Idioma original</Label>
              <Input
                id="ep-language"
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                placeholder="español"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Personajes participantes</Label>
            <CharacterMultiSelect
              projectId={projectId}
              value={form.characterIds}
              onChange={(ids) => set('characterIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Lugares</Label>
            <LocationNamesInput
              value={form.placeNames}
              onChange={(names) => set('placeNames', names)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Portada</Label>
            <CoverPicker
              projectId={projectId}
              value={form.coverAssetId}
              onChange={(id) => set('coverAssetId', id)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : episode ? 'Guardar cambios' : 'Crear episodio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
