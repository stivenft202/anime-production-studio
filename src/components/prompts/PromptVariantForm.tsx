import { useEffect, useState } from 'react'
import {
  createPromptVariant,
  updatePromptVariant,
  type PromptVariant,
  type PromptVariantInput,
} from '../../lib/prompts'
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

interface PromptVariantFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  promptId: string
  /** Contenido del prompt original: se usa como punto de partida al crear. */
  baseContent: string
  /** Si se pasa, el formulario edita; si no, crea una variante nueva. */
  variant?: PromptVariant | null
}

export function PromptVariantForm({
  open,
  onOpenChange,
  projectId,
  promptId,
  baseContent,
  variant,
}: PromptVariantFormProps) {
  const [form, setForm] = useState<PromptVariantInput>({ name: '', content: '', note: '' })
  const [nameError, setNameError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (variant) {
      setForm({ name: variant.name, content: variant.content, note: variant.note })
    } else {
      setForm({ name: '', content: baseContent, note: '' })
    }
    setNameError(null)
    setContentError(null)
  }, [open, variant, baseContent])

  const handleSave = async () => {
    let valid = true
    if (!form.name.trim()) {
      setNameError('El nombre es obligatorio.')
      valid = false
    } else {
      setNameError(null)
    }
    if (!form.content.trim()) {
      setContentError('El contenido de la variante es obligatorio.')
      valid = false
    } else {
      setContentError(null)
    }
    if (!valid) return
    setSaving(true)
    try {
      const payload: PromptVariantInput = {
        name: form.name.trim(),
        content: form.content.trim(),
        note: form.note,
      }
      if (variant) {
        await updatePromptVariant(variant.id, payload)
      } else {
        await createPromptVariant(projectId, promptId, payload)
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
            {variant ? 'Editar variante' : 'Nueva variante'}
          </DialogTitle>
          <DialogDescription>
            Una variante es una versión alternativa del prompt: parte del
            contenido original y se ajusta sin tocarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="variant-name">Nombre *</Label>
            <Input
              id="variant-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="p. ej. Versión con fondo blanco"
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="variant-content">Contenido *</Label>
            <Textarea
              id="variant-content"
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              rows={8}
            />
            {contentError && <p className="text-xs text-destructive">{contentError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="variant-note">Nota</Label>
            <Textarea
              id="variant-note"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Qué cambia respecto al original y por qué."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : variant ? 'Guardar cambios' : 'Crear variante'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
