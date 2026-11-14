import { useEffect, useState } from 'react'
import {
  createPrompt,
  GENERATION_TYPES,
  PROMPT_CATEGORIES,
  updatePrompt,
  type PromptCategory,
  type PromptEntry,
  type PromptEntryInput,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { CharacterMultiSelect, TagsInput } from '../lore/LoreFormFields'
import {
  EpisodeSceneShotPicker,
  GeneratedResultPicker,
  ReferenceImagesPicker,
} from './PromptFormFields'

const EMPTY_FORM: PromptEntryInput = {
  name: '',
  content: '',
  category: 'imagen',
  generationType: 'imagen',
  aiModel: '',
  platform: '',
  language: 'español',
  description: '',
  tags: [],
  characterIds: [],
  episodeId: undefined,
  sceneId: undefined,
  shotId: undefined,
  technicalParams: '',
  negativePrompt: '',
  durationSeconds: undefined,
  aspectRatio: '',
  resolution: '',
  imageAssetIds: [],
  generatedResultAssetId: undefined,
  isFavorite: false,
}

interface PromptFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Si se pasa, el formulario edita; si no, crea un prompt nuevo. */
  prompt?: PromptEntry | null
  onSaved?: (id: string) => void
}

export function PromptForm({ open, onOpenChange, projectId, prompt, onSaved }: PromptFormProps) {
  const [form, setForm] = useState<PromptEntryInput>(EMPTY_FORM)
  const [nameError, setNameError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (prompt) {
      setForm({
        name: prompt.name,
        content: prompt.content,
        category: prompt.category,
        generationType: prompt.generationType,
        aiModel: prompt.aiModel,
        platform: prompt.platform,
        language: prompt.language,
        description: prompt.description,
        tags: prompt.tags,
        characterIds: prompt.characterIds,
        episodeId: prompt.episodeId,
        sceneId: prompt.sceneId,
        shotId: prompt.shotId,
        technicalParams: prompt.technicalParams,
        negativePrompt: prompt.negativePrompt,
        durationSeconds: prompt.durationSeconds,
        aspectRatio: prompt.aspectRatio,
        resolution: prompt.resolution,
        imageAssetIds: prompt.imageAssetIds,
        generatedResultAssetId: prompt.generatedResultAssetId,
        isFavorite: prompt.isFavorite,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setNameError(null)
    setContentError(null)
  }, [open, prompt])

  const set = <K extends keyof PromptEntryInput>(key: K, value: PromptEntryInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    let valid = true
    if (!form.name.trim()) {
      setNameError('El nombre es obligatorio.')
      valid = false
    } else {
      setNameError(null)
    }
    if (!form.content.trim()) {
      setContentError('El contenido del prompt es obligatorio.')
      valid = false
    } else {
      setContentError(null)
    }
    if (!valid) return
    setSaving(true)
    try {
      const payload: PromptEntryInput = {
        ...form,
        name: form.name.trim(),
        content: form.content.trim(),
      }
      if (prompt) {
        await updatePrompt(prompt.id, payload)
        onSaved?.(prompt.id)
      } else {
        const id = await createPrompt(projectId, payload)
        onSaved?.(id)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prompt ? 'Editar prompt' : 'Nuevo prompt'}</DialogTitle>
          <DialogDescription>
            Guarda el prompt completo con su modelo, sus parámetros y sus
            referencias, para reutilizarlo tal cual en la herramienta de IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-name">Nombre *</Label>
              <Input
                id="prompt-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="p. ej. Hoja de personaje — estilo demo"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-category">Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set('category', v as PromptCategory)}
              >
                <SelectTrigger id="prompt-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-content">Contenido completo del prompt *</Label>
            <Textarea
              id="prompt-content"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Pega aquí el prompt tal cual se usa en la herramienta de IA…"
              rows={8}
            />
            {contentError && <p className="text-xs text-destructive">{contentError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-description">Descripción</Label>
            <Textarea
              id="prompt-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Para qué sirve este prompt y cuándo usarlo."
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-generation-type">Tipo de generación</Label>
              <Input
                id="prompt-generation-type"
                value={form.generationType}
                onChange={(e) => set('generationType', e.target.value)}
                placeholder="imagen, vídeo, voz…"
                list="generation-types"
              />
              <datalist id="generation-types">
                {GENERATION_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-language">Idioma</Label>
              <Input
                id="prompt-language"
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                placeholder="español"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-model">Modelo de IA</Label>
              <Input
                id="prompt-model"
                value={form.aiModel}
                onChange={(e) => set('aiModel', e.target.value)}
                placeholder="p. ej. Midjourney v6, DALL·E 3… (vacío si no aplica)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-platform">Plataforma</Label>
              <Input
                id="prompt-platform"
                value={form.platform}
                onChange={(e) => set('platform', e.target.value)}
                placeholder="p. ej. Midjourney, ChatGPT… (vacío si no aplica)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-negative">Negative prompt</Label>
            <Textarea
              id="prompt-negative"
              value={form.negativePrompt}
              onChange={(e) => set('negativePrompt', e.target.value)}
              placeholder="Lo que la generación NO debe incluir."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-params">Parámetros técnicos</Label>
            <Textarea
              id="prompt-params"
              value={form.technicalParams}
              onChange={(e) => set('technicalParams', e.target.value)}
              placeholder="Pasos, CFG, semilla, sampler… (texto libre)"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-duration">Duración (segundos)</Label>
              <Input
                id="prompt-duration"
                type="number"
                min={0}
                value={form.durationSeconds ?? ''}
                onChange={(e) =>
                  set(
                    'durationSeconds',
                    e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                  )
                }
                placeholder="Solo vídeo/voz/música"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-aspect">Aspecto</Label>
              <Input
                id="prompt-aspect"
                value={form.aspectRatio}
                onChange={(e) => set('aspectRatio', e.target.value)}
                placeholder="p. ej. 16:9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt-resolution">Resolución</Label>
              <Input
                id="prompt-resolution"
                value={form.resolution}
                onChange={(e) => set('resolution', e.target.value)}
                placeholder="p. ej. 1920x1080"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <TagsInput value={form.tags} onChange={(tags) => set('tags', tags)} />
          </div>

          <div className="space-y-1.5">
            <Label>Personajes</Label>
            <CharacterMultiSelect
              projectId={projectId}
              value={form.characterIds}
              onChange={(ids) => set('characterIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Episodio / escena / plano</Label>
            <EpisodeSceneShotPicker
              projectId={projectId}
              value={{
                episodeId: form.episodeId,
                sceneId: form.sceneId,
                shotId: form.shotId,
              }}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  episodeId: v.episodeId,
                  sceneId: v.sceneId,
                  shotId: v.shotId,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imágenes de referencia</Label>
            <ReferenceImagesPicker
              projectId={projectId}
              value={form.imageAssetIds}
              onChange={(ids) => set('imageAssetIds', ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Resultado generado</Label>
            <GeneratedResultPicker
              projectId={projectId}
              value={form.generatedResultAssetId}
              onChange={(id) => set('generatedResultAssetId', id)}
            />
            <p className="text-xs text-muted-foreground">
              El archivo generado con este prompt, si ya existe en el proyecto.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : prompt ? 'Guardar cambios' : 'Crear prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
