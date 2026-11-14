/**
 * Diálogo para enlazar un archivo con un elemento del proyecto
 * (fase 4): personaje, episodio, escena, plano, prompt o entrada de
 * lore. Los destinos se leen de los datos reales que existan; si un
 * tipo no tiene elementos, el selector lo dice con honestidad.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Asset, type AssetLinkTargetType, type Character, type Episode, type LoreEntry, type PromptEntry, type Scene, type Shot } from '../../db/db'
import {
  ASSET_LINK_TARGET_TYPES,
  createAssetLink,
} from '../../lib/references'
import { Button } from '../ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog'
import { Label } from '../ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'

interface LinkAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: Asset | null
  projectId: string
}

export function LinkAssetDialog({ open, onOpenChange, asset, projectId }: LinkAssetDialogProps) {
  const [targetType, setTargetType] = useState<AssetLinkTargetType>('personaje')
  const [targetId, setTargetId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const characters = useLiveQuery(
    () =>
      targetType === 'personaje'
        ? db.characters.where('projectId').equals(projectId).sortBy('name')
        : Promise.resolve([] as Character[]),
    [targetType, projectId],
  )
  const episodes = useLiveQuery(
    () =>
      targetType === 'episodio' || targetType === 'escena' || targetType === 'plano'
        ? db.episodes.where('projectId').equals(projectId).sortBy('number')
        : Promise.resolve([] as Episode[]),
    [targetType, projectId],
  )
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('')
  const scenes = useLiveQuery(
    () =>
      (targetType === 'escena' || targetType === 'plano') && selectedEpisodeId
        ? db.scenes.where('episodeId').equals(selectedEpisodeId).sortBy('number')
        : Promise.resolve([] as Scene[]),
    [targetType, selectedEpisodeId],
  )
  const [selectedSceneId, setSelectedSceneId] = useState<string>('')
  const shots = useLiveQuery(
    () =>
      targetType === 'plano' && selectedSceneId
        ? db.shots.where('sceneId').equals(selectedSceneId).sortBy('number')
        : Promise.resolve([] as Shot[]),
    [targetType, selectedSceneId],
  )
  const prompts = useLiveQuery(
    () =>
      targetType === 'prompt'
        ? db.prompts.where('projectId').equals(projectId).sortBy('name')
        : Promise.resolve([] as PromptEntry[]),
    [targetType, projectId],
  )
  const loreEntries = useLiveQuery(
    () =>
      targetType === 'lore'
        ? db.loreEntries.where('projectId').equals(projectId).sortBy('title')
        : Promise.resolve([] as LoreEntry[]),
    [targetType, projectId],
  )

  useEffect(() => {
    if (!open) return
    setTargetType('personaje')
    setTargetId('')
    setSelectedEpisodeId('')
    setSelectedSceneId('')
    setNote(null)
  }, [open ])

  // El destino efectivo depende del tipo: para escena/plano hay que
  // bajar por episodio (y escena) antes de elegir el destino final.
  const effectiveTargetId = useMemo(() => {
    if (targetType === 'escena') return targetId
    if (targetType === 'plano') return targetId
    return targetId
  }, [targetType, targetId])

  const targets = useMemo(() => {
    switch (targetType) {
      case 'personaje':
        return (characters ?? []).map((c) => ({ id: c.id, label: c.name }))
      case 'episodio':
        return (episodes ?? []).map((e) => ({
          id: e.id,
          label: `Episodio ${e.number}${e.title ? ` — ${e.title}` : ''}`,
        }))
      case 'escena':
        return (scenes ?? []).map((s) => ({
          id: s.id,
          label: `Escena ${s.number}${s.title ? ` — ${s.title}` : ''}`,
        }))
      case 'plano':
        return (shots ?? []).map((s) => ({ id: s.id, label: `Plano ${s.number}` }))
      case 'prompt':
        return (prompts ?? []).map((p) => ({ id: p.id, label: p.name }))
      case 'lore':
        return (loreEntries ?? []).map((l) => ({ id: l.id, label: l.title }))
      default:
        return []
    }
  }, [targetType, characters, episodes, scenes, shots, prompts, loreEntries])

  const needsEpisodeFirst = targetType === 'escena' || targetType === 'plano'
  const needsSceneFirst = targetType === 'plano'

  const handleSave = async () => {
    if (!asset || !effectiveTargetId) return
    setSaving(true)
    try {
      await createAssetLink(projectId, asset.id, targetType, effectiveTargetId)
      setNote('Enlace creado.')
      setTimeout(() => onOpenChange(false), 400)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enlazar archivo</DialogTitle>
          <DialogDescription>
            {asset
              ? `Enlaza «${asset.name}» con un elemento del proyecto. Un mismo archivo puede enlazarse con varios elementos.`
              : 'Enlaza el archivo con un elemento del proyecto.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de elemento</Label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType(v as AssetLinkTargetType)
                setTargetId('')
                setSelectedEpisodeId('')
                setSelectedSceneId('')
                setNote(null)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_LINK_TARGET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Los lugares y objetos detallados llegan en la fase 5.
            </p>
          </div>

          {needsEpisodeFirst && (
            <div className="space-y-1.5">
              <Label>Episodio</Label>
              <Select
                value={selectedEpisodeId || 'ninguno'}
                onValueChange={(v) => {
                  setSelectedEpisodeId(v === 'ninguno' ? '' : v)
                  setSelectedSceneId('')
                  setTargetId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elige un episodio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin episodio</SelectItem>
                  {(episodes ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      Ep. {e.number}
                      {e.title ? ` — ${e.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(episodes ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Este proyecto aún no tiene episodios.
                </p>
              )}
            </div>
          )}

          {needsSceneFirst && (
            <div className="space-y-1.5">
              <Label>Escena</Label>
              <Select
                value={selectedSceneId || 'ninguna'}
                disabled={!selectedEpisodeId || (scenes ?? []).length === 0}
                onValueChange={(v) => {
                  setSelectedSceneId(v === 'ninguna' ? '' : v)
                  setTargetId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elige una escena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin escena</SelectItem>
                  {(scenes ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Escena {s.number}
                      {s.title ? ` — ${s.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEpisodeId && (scenes ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Este episodio aún no tiene escenas.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {targetType === 'personaje' && 'Personaje'}
              {targetType === 'episodio' && 'Episodio'}
              {targetType === 'escena' && 'Escena'}
              {targetType === 'plano' && 'Plano'}
              {targetType === 'prompt' && 'Prompt'}
              {targetType === 'lore' && 'Entrada de lore'}
            </Label>
            <Select
              value={targetId || 'ninguno'}
              disabled={
                targets.length === 0 ||
                (needsEpisodeFirst && !selectedEpisodeId) ||
                (needsSceneFirst && !selectedSceneId)
              }
              onValueChange={(v) => setTargetId(v === 'ninguno' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elige el destino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin destino</SelectItem>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targets.length === 0 &&
              !(needsEpisodeFirst && !selectedEpisodeId) &&
              !(needsSceneFirst && !selectedSceneId) && (
                <p className="text-xs text-muted-foreground">
                  No hay elementos de este tipo en el proyecto todavía.
                </p>
              )}
          </div>

          {note && <p className="text-sm text-green-600">{note}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !targetId}>
            {saving ? 'Enlazando…' : 'Crear enlace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
