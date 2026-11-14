import { useEffect, useState } from 'react'
import { db } from '../../db/db'
import {
  createShot,
  nextShotNumber,
  SHOT_RESULT_STATUSES,
  updateShot,
  type Shot,
  type ShotInput,
  type ShotResultStatus,
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
import { CharacterMultiSelect, ImagePicker } from '../lore/LoreFormFields'
import { AssetFilePicker, PromptSelect } from './ScriptFields'

const EMPTY_FORM: ShotInput = {
  number: 1,
  visualDescription: '',
  action: '',
  cameraMovement: '',
  framing: '',
  characterIds: [],
  imageAssetIds: [],
  resultStatus: 'borrador',
}

interface ShotFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  sceneId: string
  /** Si se pasa, el formulario edita; si no, crea un plano nuevo. */
  shot?: Shot | null
  onSaved?: (id: string) => void
}

export function ShotForm({ open, onOpenChange, projectId, sceneId, shot, onSaved }: ShotFormProps) {
  const [form, setForm] = useState<ShotInput>(EMPTY_FORM)
  const [durationText, setDurationText] = useState('')
  const [numberError, setNumberError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (shot) {
      setForm({
        number: shot.number,
        visualDescription: shot.visualDescription,
        action: shot.action,
        cameraMovement: shot.cameraMovement,
        framing: shot.framing,
        durationSeconds: shot.durationSeconds,
        characterIds: shot.characterIds,
        imageAssetIds: shot.imageAssetIds,
        promptId: shot.promptId,
        aiModel: shot.aiModel,
        generatedVideoAssetId: shot.generatedVideoAssetId,
        resultStatus: shot.resultStatus,
      })
      setDurationText(
        shot.durationSeconds === undefined ? '' : String(shot.durationSeconds),
      )
    } else {
      setForm(EMPTY_FORM)
      setDurationText('')
      void nextShotNumber(db, sceneId).then((n) =>
        setForm((prev) => ({ ...prev, number: n })),
      )
    }
    setNumberError(null)
  }, [open, shot, sceneId])

  const set = <K extends keyof ShotInput>(key: K, value: ShotInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!Number.isInteger(form.number) || form.number < 1) {
      setNumberError('El número de plano debe ser un entero mayor que 0.')
      return
    }
    setNumberError(null)
    setSaving(true)
    try {
      const duration = durationText.trim() === '' ? undefined : Number(durationText)
      const payload: ShotInput = {
        ...form,
        visualDescription: form.visualDescription.trim(),
        action: form.action.trim(),
        cameraMovement: form.cameraMovement.trim(),
        framing: form.framing.trim(),
        aiModel: form.aiModel?.trim() || undefined,
        promptId: form.promptId || undefined,
        durationSeconds:
          duration === undefined || Number.isNaN(duration) || duration <= 0
            ? undefined
            : Math.round(duration),
      }
      if (shot) {
        await updateShot(db, shot.id, payload)
        onSaved?.(shot.id)
      } else {
        const id = await createShot(db, projectId, sceneId, payload)
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
          <DialogTitle>{shot ? 'Editar plano' : 'Nuevo plano'}</DialogTitle>
          <DialogDescription>
            Un plano es una toma dentro de una escena: qué se ve, qué pasa y
            cómo se mueve la cámara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="shot-number">Número *</Label>
              <Input
                id="shot-number"
                type="number"
                min={1}
                step={1}
                value={form.number}
                onChange={(e) => set('number', Number(e.target.value))}
              />
              {numberError && <p className="text-xs text-destructive">{numberError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-duration">Duración (segundos)</Label>
              <Input
                id="shot-duration"
                type="number"
                min={0}
                step={1}
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-status">Estado del resultado</Label>
              <Select
                value={form.resultStatus}
                onValueChange={(v) => set('resultStatus', v as ShotResultStatus)}
              >
                <SelectTrigger id="shot-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHOT_RESULT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shot-visual">Descripción visual</Label>
            <Textarea
              id="shot-visual"
              value={form.visualDescription}
              onChange={(e) => set('visualDescription', e.target.value)}
              placeholder="Qué se ve en el plano."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shot-action">Acción</Label>
            <Textarea
              id="shot-action"
              value={form.action}
              onChange={(e) => set('action', e.target.value)}
              placeholder="Qué ocurre durante el plano."
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shot-camera">Movimiento de cámara</Label>
              <Input
                id="shot-camera"
                value={form.cameraMovement}
                onChange={(e) => set('cameraMovement', e.target.value)}
                placeholder="Travelling, paneo, fijo…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-framing">Encuadre</Label>
              <Input
                id="shot-framing"
                value={form.framing}
                onChange={(e) => set('framing', e.target.value)}
                placeholder="Plano general, primer plano…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Personajes en el plano</Label>
            <CharacterMultiSelect
              projectId={projectId}
              value={form.characterIds}
              onChange={(ids) => set('characterIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prompt usado</Label>
            <PromptSelect
              projectId={projectId}
              value={form.promptId ?? ''}
              onChange={(v) => set('promptId', typeof v === 'string' ? v || undefined : undefined)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shot-model">Modelo de IA</Label>
            <Input
              id="shot-model"
              value={form.aiModel ?? ''}
              onChange={(e) => set('aiModel', e.target.value)}
              placeholder="p. ej. Runway Gen-3, Kling…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vídeo generado</Label>
            <AssetFilePicker
              projectId={projectId}
              kind="video"
              value={form.generatedVideoAssetId}
              onChange={(id) => set('generatedVideoAssetId', id)}
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
            {saving ? 'Guardando…' : shot ? 'Guardar cambios' : 'Crear plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
