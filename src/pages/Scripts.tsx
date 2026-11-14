import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  Download,
  MessageSquare,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  Upload,
} from 'lucide-react'
import { db, type DialogueLine, type Episode, type Scene, type Shot } from '../db/db'
import {
  deleteDialogueLine,
  deleteEpisodeCascade,
  deleteSceneCascade,
  deleteShot,
  duplicateEpisode,
  episodeLabel,
  formatDuration,
  listDialogueLines,
  listEpisodes,
  listScenes,
  listShots,
  moveDialogueLine,
  moveScene,
  moveShot,
  updateEpisode,
  EPISODE_STATUS_LABELS,
  SHOT_RESULT_STATUS_LABELS,
} from '../lib/scripts'
import {
  exportEpisodeDocx,
  exportEpisodeMd,
  exportEpisodePdf,
  exportEpisodeTxt,
  importScriptFile,
} from '../lib/scriptIO'
import { useAppStore } from '../store/appStore'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { useAssetUrlMap } from '../components/characters/useAssetUrls'
import { EpisodeForm } from '../components/scripts/EpisodeForm'
import { SceneForm } from '../components/scripts/SceneForm'
import { ShotForm } from '../components/scripts/ShotForm'
import { DialogueForm } from '../components/scripts/DialogueForm'
import { ScriptEditor } from '../components/scripts/ScriptEditor'

type DetailTab = 'guion' | 'escenas' | 'dialogos'

export function Scripts() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)

  const episodes = useLiveQuery(
    () =>
      activeProjectId
        ? listEpisodes(db, activeProjectId)
        : Promise.resolve([] as Episode[]),
    [activeProjectId],
  )
  const allScenes = useLiveQuery(
    () =>
      activeProjectId
        ? db.scenes.where('projectId').equals(activeProjectId).toArray()
        : Promise.resolve([] as Scene[]),
    [activeProjectId],
  )
  const allDialogues = useLiveQuery(
    () =>
      activeProjectId
        ? db.dialogueLines.where('projectId').equals(activeProjectId).toArray()
        : Promise.resolve([] as DialogueLine[]),
    [activeProjectId],
  )

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null)
  const [episodeFormOpen, setEpisodeFormOpen] = useState(false)
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null)
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null)

  if (!activeProjectId) {
    return (
      <EmptyState
        title="No hay proyecto activo"
        description="Selecciona o crea un proyecto para ver y gestionar sus episodios y guiones."
      />
    )
  }

  const selectedEpisode = selectedEpisodeId
    ? (episodes ?? []).find((e) => e.id === selectedEpisodeId) ?? null
    : null

  const sceneCountByEpisode = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of allScenes ?? []) map.set(s.episodeId, (map.get(s.episodeId) ?? 0) + 1)
    return map
  }, [allScenes])

  const dialogueCountByEpisode = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of allDialogues ?? []) map.set(d.episodeId, (map.get(d.episodeId) ?? 0) + 1)
    return map
  }, [allDialogues])

  const openCreateEpisode = () => {
    setEditingEpisode(null)
    setEpisodeFormOpen(true)
  }
  const openEditEpisode = (episode: Episode) => {
    setEditingEpisode(episode)
    setEpisodeFormOpen(true)
  }
  const handleDeleteEpisode = async (episode: Episode) => {
    await deleteEpisodeCascade(db, episode.id)
    setEpisodeToDelete(null)
    if (selectedEpisodeId === episode.id) setSelectedEpisodeId(null)
  }

  // Vista detalle de un episodio
  if (selectedEpisode) {
    return (
      <div className="space-y-6 p-6">
        <EpisodeDetail
          episode={selectedEpisode}
          projectId={activeProjectId}
          onBack={() => setSelectedEpisodeId(null)}
          onEdit={() => openEditEpisode(selectedEpisode)}
          onDelete={() => setEpisodeToDelete(selectedEpisode)}
        />
        <EpisodeForm
          open={episodeFormOpen}
          onOpenChange={setEpisodeFormOpen}
          projectId={activeProjectId}
          episode={editingEpisode}
          onSaved={(id) => setSelectedEpisodeId(id)}
        />
        <ConfirmDialog
          open={episodeToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setEpisodeToDelete(null)
          }}
          title={episodeToDelete ? `Eliminar «${episodeLabel(episodeToDelete)}»` : 'Eliminar episodio'}
          message="El episodio se eliminará con todas sus escenas, planos, diálogos y su guion. Esta acción no se puede deshacer."
          onConfirm={() => {
            if (episodeToDelete) void handleDeleteEpisode(episodeToDelete)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Guiones y episodios</h1>
          <p className="text-sm text-muted-foreground">
            {episodes === undefined
              ? 'Cargando…'
              : `${episodes.length} ${episodes.length === 1 ? 'episodio' : 'episodios'} en este proyecto`}
          </p>
        </div>
        <div className="flex-1" />
        <Button onClick={openCreateEpisode}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo episodio
        </Button>
      </div>

      {episodes === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando episodios…</p>
      ) : episodes.length === 0 ? (
        <EmptyState
          title="Aún no hay episodios en este proyecto"
          description="Crea el primer episodio para empezar a escribir su guion, sus escenas, sus planos y sus diálogos."
          action={
            <Button onClick={openCreateEpisode}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo episodio
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {episodes.map((episode) => (
            <Card
              key={episode.id}
              className="flex cursor-pointer flex-col transition-colors hover:border-primary/50"
              onClick={() => setSelectedEpisodeId(episode.id)}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{episodeLabel(episode)}</CardTitle>
                  <Badge>{EPISODE_STATUS_LABELS[episode.status]}</Badge>
                </div>
                <CardDescription>
                  {episode.seasonNumber !== undefined
                    ? `Temporada ${episode.seasonNumber} · `
                    : ''}
                  Duración estimada: {formatDuration(episode.durationSeconds)}
                  {episode.language ? ` · ${episode.language}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {episode.synopsis || 'Sin sinopsis.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sceneCountByEpisode.get(episode.id) ?? 0}{' '}
                  {(sceneCountByEpisode.get(episode.id) ?? 0) === 1 ? 'escena' : 'escenas'}
                  {' · '}
                  {dialogueCountByEpisode.get(episode.id) ?? 0}{' '}
                  {(dialogueCountByEpisode.get(episode.id) ?? 0) === 1 ? 'diálogo' : 'diálogos'}
                  {episode.scriptText ? ' · Guion con contenido' : ' · Sin guion todavía'}
                </p>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditEpisode(episode)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void duplicateEpisode(db, episode.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEpisodeToDelete(episode)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EpisodeForm
        open={episodeFormOpen}
        onOpenChange={setEpisodeFormOpen}
        projectId={activeProjectId}
        episode={editingEpisode}
        onSaved={(id) => setSelectedEpisodeId(id)}
      />
      <ConfirmDialog
        open={episodeToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setEpisodeToDelete(null)
        }}
        title={episodeToDelete ? `Eliminar «${episodeLabel(episodeToDelete)}»` : 'Eliminar episodio'}
        message="El episodio se eliminará con todas sus escenas, planos, diálogos y su guion. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (episodeToDelete) void handleDeleteEpisode(episodeToDelete)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detalle de un episodio: guion, escenas y diálogos                   */
/* ------------------------------------------------------------------ */

function EpisodeDetail({
  episode,
  projectId,
  onBack,
  onEdit,
  onDelete,
}: {
  episode: Episode
  projectId: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('guion')
  const [importError, setImportError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const coverUrls = useAssetUrlMap(episode.coverAssetId ? [episode.coverAssetId] : [])

  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])

  const handleImportFile = async (file: File) => {
    setImportError(null)
    try {
      const imported = await importScriptFile(file)
      await updateEpisode(db, episode.id, {
        scriptJson: imported.scriptJson,
        scriptText: imported.text,
      })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No se pudo importar el archivo.')
    }
  }

  const requestImport = (file: File) => {
    if ((episode.scriptText ?? '').trim()) {
      // El episodio ya tiene guion: pedir confirmación antes de sustituirlo.
      setPendingImport(file)
    } else {
      void handleImportFile(file)
    }
  }

  const handleExportDocx = async () => {
    setExportError(null)
    try {
      await exportEpisodeDocx(episode)
    } catch {
      setExportError('No se pudo exportar el DOCX.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a episodios
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Importar guion
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) requestImport(e.target.files[0])
            e.target.value = ''
          }}
        />
        <Button variant="outline" onClick={() => exportEpisodeTxt(episode)}>
          <Download className="mr-2 h-4 w-4" />
          TXT
        </Button>
        <Button variant="outline" onClick={() => exportEpisodeMd(episode)}>
          <Download className="mr-2 h-4 w-4" />
          MD
        </Button>
        <Button variant="outline" onClick={() => void handleExportDocx()}>
          <Download className="mr-2 h-4 w-4" />
          DOCX
        </Button>
        <Button variant="outline" onClick={() => exportEpisodePdf(episode)}>
          <Download className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </div>

      {(importError || exportError) && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {importError ?? exportError}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        {episode.coverAssetId && coverUrls[episode.coverAssetId] && (
          <div className="aspect-video w-full shrink-0 overflow-hidden rounded-md border bg-muted sm:w-64">
            <img
              src={coverUrls[episode.coverAssetId]}
              alt="Portada del episodio"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{episodeLabel(episode)}</h1>
            <Badge>{EPISODE_STATUS_LABELS[episode.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {episode.seasonNumber !== undefined ? `Temporada ${episode.seasonNumber} · ` : ''}
            Duración estimada: {formatDuration(episode.durationSeconds)}
            {episode.language ? ` · Idioma original: ${episode.language}` : ''}
          </p>
          {episode.synopsis && <p className="mt-2 text-sm">{episode.synopsis}</p>}
          {episode.characterIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {episode.characterIds.map((id) => {
                const name = characterById.get(id)
                if (!name) return null
                return (
                  <Badge key={id} variant="secondary">
                    {name}
                  </Badge>
                )
              })}
            </div>
          )}
          {episode.placeNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {episode.placeNames.map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Importar un guion (.txt, .md o .docx) sustituye el guion actual
            del episodio.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
        <TabsList>
          <TabsTrigger value="guion">
            <ScrollText className="mr-1.5 h-4 w-4" />
            Guion
          </TabsTrigger>
          <TabsTrigger value="escenas">
            <Clapperboard className="mr-1.5 h-4 w-4" />
            Escenas
          </TabsTrigger>
          <TabsTrigger value="dialogos">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Diálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guion" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <ScriptEditor key={episode.id} episode={episode} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escenas" className="space-y-4">
          <ScenesTab episode={episode} projectId={projectId} />
        </TabsContent>

        <TabsContent value="dialogos" className="space-y-4">
          <DialoguesTab episode={episode} projectId={projectId} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
        title="Sustituir el guion actual"
        message="Este episodio ya tiene un guion. Al importar, el guion actual se sustituirá por completo por el contenido del archivo. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (pendingImport) void handleImportFile(pendingImport)
          setPendingImport(null)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pestaña Escenas (+ planos de la escena seleccionada)                */
/* ------------------------------------------------------------------ */

function ScenesTab({ episode, projectId }: { episode: Episode; projectId: string }) {
  const scenes = useLiveQuery(() => listScenes(db, episode.id), [episode.id])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [sceneFormOpen, setSceneFormOpen] = useState(false)
  const [editingScene, setEditingScene] = useState<Scene | null>(null)
  const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null)

  const selectedScene = selectedSceneId
    ? (scenes ?? []).find((s) => s.id === selectedSceneId) ?? null
    : null
  // Si no hay escena seleccionada, se toma la primera de la lista.
  const activeScene = selectedScene ?? (scenes ?? [])[0] ?? null

  const openCreateScene = () => {
    setEditingScene(null)
    setSceneFormOpen(true)
  }
  const openEditScene = (scene: Scene) => {
    setEditingScene(scene)
    setSceneFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          Escenas {scenes ? `(${scenes.length})` : ''}
        </h2>
        <div className="flex-1" />
        <Button onClick={openCreateScene}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva escena
        </Button>
      </div>

      {scenes === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando escenas…</p>
      ) : scenes.length === 0 ? (
        <EmptyState
          title="Este episodio aún no tiene escenas"
          description="Añade la primera escena: su lugar, su momento y los personajes que aparecen."
          action={
            <Button onClick={openCreateScene}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva escena
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {scenes.map((scene, index) => (
              <Card
                key={scene.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${
                  activeScene?.id === scene.id ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedSceneId(scene.id)}
              >
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      Escena {scene.number}
                      {scene.title ? ` — ${scene.title}` : ''}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === 0}
                        title="Subir"
                        onClick={(e) => {
                          e.stopPropagation()
                          void moveScene(db, scene.id, -1)
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === scenes.length - 1}
                        title="Bajar"
                        onClick={(e) => {
                          e.stopPropagation()
                          void moveScene(db, scene.id, 1)
                        }}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[scene.locationName, scene.timeOfDay].filter(Boolean).join(' · ') ||
                      'Sin ubicación ni momento.'}
                  </p>
                  {scene.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {scene.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {activeScene && (
            <SceneDetail
              scene={activeScene}
              projectId={projectId}
              onEdit={() => openEditScene(activeScene)}
              onDelete={() => setSceneToDelete(activeScene)}
            />
          )}
        </div>
      )}

      <SceneForm
        open={sceneFormOpen}
        onOpenChange={setSceneFormOpen}
        projectId={projectId}
        episodeId={episode.id}
        scene={editingScene}
        onSaved={(id) => setSelectedSceneId(id)}
      />
      <ConfirmDialog
        open={sceneToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSceneToDelete(null)
        }}
        title={sceneToDelete ? `Eliminar la escena ${sceneToDelete.number}` : 'Eliminar escena'}
        message="La escena se eliminará con todos sus planos y sus diálogos. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (sceneToDelete) {
            void deleteSceneCascade(db, sceneToDelete.id)
            if (selectedSceneId === sceneToDelete.id) setSelectedSceneId(null)
          }
          setSceneToDelete(null)
        }}
      />
    </div>
  )
}

/** Detalle de la escena seleccionada: datos + sus planos. */
function SceneDetail({
  scene,
  projectId,
  onEdit,
  onDelete,
}: {
  scene: Scene
  projectId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const shots = useLiveQuery(() => listShots(db, scene.id), [scene.id])
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const prompts = useLiveQuery(
    () => db.prompts.where('projectId').equals(projectId).toArray(),
    [projectId],
  )
  const [shotFormOpen, setShotFormOpen] = useState(false)
  const [editingShot, setEditingShot] = useState<Shot | null>(null)
  const [shotToDelete, setShotToDelete] = useState<Shot | null>(null)

  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])
  const promptById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of prompts ?? []) map.set(p.id, p.name)
    return map
  }, [prompts])

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Escena {scene.number}
              {scene.title ? ` — ${scene.title}` : ''}
            </CardTitle>
            <CardDescription>
              {[scene.locationName, scene.timeOfDay].filter(Boolean).join(' · ') ||
                'Sin ubicación ni momento.'}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {scene.description && <p className="text-sm">{scene.description}</p>}
        {scene.characterIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {scene.characterIds.map((id) => {
              const name = characterById.get(id)
              if (!name) return null
              return (
                <Badge key={id} variant="secondary">
                  {name}
                </Badge>
              )
            })}
          </div>
        )}
        {scene.promptIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {scene.promptIds.map((id) => {
              const name = promptById.get(id)
              if (!name) return null
              return <Badge key={id} variant="outline">{name}</Badge>
            })}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">
            Planos {shots ? `(${shots.length})` : ''}
          </h3>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => {
              setEditingShot(null)
              setShotFormOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo plano
          </Button>
        </div>

        {shots === undefined ? (
          <p className="text-sm text-muted-foreground">Cargando planos…</p>
        ) : shots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta escena aún no tiene planos. Añade el primero para describir
            qué se ve y cómo se mueve la cámara.
          </p>
        ) : (
          <div className="space-y-2">
            {shots.map((shot, index) => (
              <div key={shot.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    Plano {shot.number}
                    {shot.durationSeconds !== undefined &&
                      ` · ${formatDuration(shot.durationSeconds)}`}
                  </p>
                  <Badge variant={shot.resultStatus === 'terminado' ? 'default' : 'secondary'}>
                    {SHOT_RESULT_STATUS_LABELS[shot.resultStatus]}
                  </Badge>
                </div>
                {shot.visualDescription && (
                  <p className="mt-1 text-sm text-muted-foreground">{shot.visualDescription}</p>
                )}
                {shot.action && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Acción: </span>
                    {shot.action}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    shot.framing ? `Encuadre: ${shot.framing}` : '',
                    shot.cameraMovement ? `Cámara: ${shot.cameraMovement}` : '',
                    shot.aiModel ? `Modelo: ${shot.aiModel}` : '',
                    shot.promptId ? `Prompt: ${promptById.get(shot.promptId) ?? '—'}` : '',
                    shot.generatedVideoAssetId ? 'Vídeo generado: sí' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin detalles de cámara.'}
                </p>
                {shot.characterIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shot.characterIds.map((id) => {
                      const name = characterById.get(id)
                      if (!name) return null
                      return (
                        <Badge key={id} variant="secondary">
                          {name}
                        </Badge>
                      )
                    })}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => void moveShot(db, shot.id, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === shots.length - 1}
                    onClick={() => void moveShot(db, shot.id, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingShot(shot)
                      setShotFormOpen(true)
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShotToDelete(shot)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ShotForm
        open={shotFormOpen}
        onOpenChange={setShotFormOpen}
        projectId={projectId}
        sceneId={scene.id}
        shot={editingShot}
      />
      <ConfirmDialog
        open={shotToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setShotToDelete(null)
        }}
        title={shotToDelete ? `Eliminar el plano ${shotToDelete.number}` : 'Eliminar plano'}
        message="El plano se eliminará. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (shotToDelete) void deleteShot(db, shotToDelete.id)
          setShotToDelete(null)
        }}
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Pestaña Diálogos: lista ordenable, filtrable por escena             */
/* ------------------------------------------------------------------ */

function DialoguesTab({ episode, projectId }: { episode: Episode; projectId: string }) {
  const lines = useLiveQuery(() => listDialogueLines(db, episode.id), [episode.id])
  const scenes = useLiveQuery(() => listScenes(db, episode.id), [episode.id])
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const [sceneFilter, setSceneFilter] = useState<string>('todas')
  const [dialogueFormOpen, setDialogueFormOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<DialogueLine | null>(null)
  const [lineToDelete, setLineToDelete] = useState<DialogueLine | null>(null)

  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])
  const sceneById = useMemo(() => {
    const map = new Map<string, Scene>()
    for (const s of scenes ?? []) map.set(s.id, s)
    return map
  }, [scenes])

  const filteredLines = useMemo(() => {
    const list = lines ?? []
    if (sceneFilter === 'todas') return list
    if (sceneFilter === 'sin-escena') return list.filter((l) => !l.sceneId)
    return list.filter((l) => l.sceneId === sceneFilter)
  }, [lines, sceneFilter])

  const openCreateLine = () => {
    setEditingLine(null)
    setDialogueFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          Diálogos {lines ? `(${lines.length})` : ''}
        </h2>
        <div className="flex-1" />
        <Select value={sceneFilter} onValueChange={setSceneFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por escena" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las escenas</SelectItem>
            <SelectItem value="sin-escena">Sin escena</SelectItem>
            {(scenes ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                Escena {s.number}
                {s.title ? ` — ${s.title}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreateLine}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo diálogo
        </Button>
      </div>

      {lines === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando diálogos…</p>
      ) : filteredLines.length === 0 ? (
        <EmptyState
          title={
            lines.length === 0
              ? 'Este episodio aún no tiene diálogos'
              : 'Sin diálogos en esta escena'
          }
          description="Añade la primera línea: quién la dice, qué dice y con qué emoción."
          action={
            <Button onClick={openCreateLine}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo diálogo
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredLines.map((line, index) => {
            const scene = line.sceneId ? sceneById.get(line.sceneId) : undefined
            const characterName = line.characterId
              ? (characterById.get(line.characterId) ?? 'Personaje eliminado')
              : 'Narración'
            return (
              <Card key={line.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-semibold">{characterName}</span>
                      {line.emotion && (
                        <Badge variant="secondary" className="ml-2">
                          {line.emotion}
                        </Badge>
                      )}
                      {scene && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Escena {scene.number}
                          {scene.title ? ` — ${scene.title}` : ''}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === 0}
                        title="Subir"
                        onClick={() => void moveDialogueLine(db, line.id, -1)}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === filteredLines.length - 1}
                        title="Bajar"
                        onClick={() => void moveDialogueLine(db, line.id, 1)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingLine(line)
                          setDialogueFormOpen(true)
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLineToDelete(line)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm italic">«{line.text}»</p>
                  {line.performanceNotes && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Interpretación: </span>
                      {line.performanceNotes}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[
                      line.language ? `Idioma: ${line.language}` : '',
                      line.voiceActorName ? `Actor: ${line.voiceActorName}` : '',
                      line.audioAssetId ? 'Audio: sí' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos de voz.'}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <DialogueForm
        open={dialogueFormOpen}
        onOpenChange={setDialogueFormOpen}
        projectId={projectId}
        episodeId={episode.id}
        line={editingLine}
        defaultSceneId={
          sceneFilter !== 'todas' && sceneFilter !== 'sin-escena' ? sceneFilter : undefined
        }
      />
      <ConfirmDialog
        open={lineToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setLineToDelete(null)
        }}
        title="Eliminar diálogo"
        message="La línea de diálogo se eliminará. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (lineToDelete) void deleteDialogueLine(db, lineToDelete.id)
          setLineToDelete(null)
        }}
      />
    </div>
  )
}
