import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import {
  createDialogueLine,
  updateDialogueLine,
  type DialogueLine,
  type DialogueLineInput,
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
import { AssetFilePicker } from './ScriptFields'

const EMPTY_FORM: DialogueLineInput = {
  text: '',
  performanceNotes: '',
  emotion: '',
  language: 'español',
}

interface DialogueFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  episodeId: string
  /** Si se pasa, el formulario edita; si no, crea una línea nueva. */
  line?: DialogueLine | null
  /** Escena preseleccionada al crear (la seleccionada en la lista). */
  defaultSceneId?: string
  onSaved?: (id: string) => void
}

export function DialogueForm({
  open,
  onOpenChange,
  projectId,
  episodeId,
  line,
  defaultSceneId,
  onSaved,
}: DialogueFormProps) {
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const scenes = useLiveQuery(
    () => db.scenes.where('episodeId').equals(episodeId).sortBy('orderIndex'),
    [episodeId],
  )

  const [form, setForm] = useState<DialogueLineInput>(EMPTY_FORM)
  const [textError, setTextError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (line) {
      setForm({
        sceneId: line.sceneId,
        shotId: line.shotId,
        characterId: line.characterId,
        text: line.text,
        performanceNotes: line.performanceNotes,
        emotion: line.emotion,
        language: line.language,
        voiceActorName: line.voiceActorName,
        audioAssetId: line.audioAssetId,
      })
    } else {
      setForm({ ...EMPTY_FORM, sceneId: defaultSceneId || undefined })
    }
    setTextError(null)
  }, [open, line, defaultSceneId])

  const set = <K extends keyof DialogueLineInput>(key: K, value: DialogueLineInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.text.trim()) {
      setTextError('El texto del diálogo es obligatorio.')
      return
    }
    setTextError(null)
    setSaving(true)
    try {
      const payload: DialogueLineInput = {
        ...form,
        text: form.text.trim(),
        performanceNotes: form.performanceNotes.trim(),
        emotion: form.emotion.trim(),
        language: form.language.trim() || 'español',
        voiceActorName: form.voiceActorName?.trim() || undefined,
        sceneId: form.sceneId || undefined,
        characterId: form.characterId || undefined,
      }
      if (line) {
        await updateDialogueLine(db, line.id, payload)
        onSaved?.(line.id)
      } else {
        const id = await createDialogueLine(db, projectId, episodeId, payload)
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
          <DialogTitle>{line ? 'Editar diálogo' : 'Nuevo diálogo'}</DialogTitle>
          <DialogDescription>
            Una línea de diálogo de un personaje, con su emoción y sus notas
            de interpretación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dlg-character">Personaje</Label>
              <Select
                value={form.characterId ?? '__none__'}
                onValueChange={(v) => set('characterId', v === '__none__' ? undefined : v)}
              >
                <SelectTrigger id="dlg-character">
                  <SelectValue placeholder="Sin personaje (narración)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin personaje (narración)</SelectItem>
                  {(characters ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dlg-scene">Escena</Label>
              <Select
                value={form.sceneId ?? '__none__'}
                onValueChange={(v) => set('sceneId', v === '__none__' ? undefined : v)}
              >
                <SelectTrigger id="dlg-scene">
                  <SelectValue placeholder="Sin escena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin escena</SelectItem>
                  {(scenes ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Escena {s.number}
                      {s.title ? ` — ${s.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dlg-text">Texto *</Label>
            <Textarea
              id="dlg-text"
              value={form.text}
              onChange={(e) => set('text', e.target.value)}
              placeholder="Lo que dice el personaje."
              rows={3}
            />
            {textError && <p className="text-xs text-destructive">{textError}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dlg-emotion">Emoción</Label>
              <Input
                id="dlg-emotion"
                value={form.emotion}
                onChange={(e) => set('emotion', e.target.value)}
                placeholder="Enfadado, triste, alegre…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dlg-language">Idioma</Label>
              <Input
                id="dlg-language"
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                placeholder="español"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dlg-actor">Actor de voz asignado</Label>
            <Input
              id="dlg-actor"
              value={form.voiceActorName ?? ''}
              onChange={(e) => set('voiceActorName', e.target.value)}
              placeholder="Nombre del actor o actriz"
            />
            <p className="text-xs text-muted-foreground">
              Los actores de voz detallados llegan en la fase 5; por ahora se
              guarda el nombre.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dlg-notes">Notas de interpretación</Label>
            <Textarea
              id="dlg-notes"
              value={form.performanceNotes}
              onChange={(e) => set('performanceNotes', e.target.value)}
              placeholder="Cómo debe decirse la línea."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Audio asociado</Label>
            <AssetFilePicker
              projectId={projectId}
              kind="audio"
              value={form.audioAssetId}
              onChange={(id) => set('audioAssetId', id)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : line ? 'Guardar cambios' : 'Crear diálogo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
