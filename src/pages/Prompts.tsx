import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { db, type Character, type PromptEntry, type PromptVariant, type Scene, type Shot } from '../db/db'
import {
  copyTextToClipboard,
  deletePrompt,
  deletePromptVariant,
  duplicatePrompt,
  listPrompts,
  listPromptVariants,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  togglePromptFavorite,
} from '../lib/prompts'
import { useAppStore } from '../store/appStore'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { Switch } from '../components/ui/Switch'
import { Label } from '../components/ui/Label'
import { useAssetUrlMap } from '../components/characters/useAssetUrls'
import { PromptForm } from '../components/prompts/PromptForm'
import { PromptVariantForm } from '../components/prompts/PromptVariantForm'

type SortMode = 'fecha-desc' | 'fecha-asc' | 'nombre'

export function Prompts() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)

  const prompts = useLiveQuery(
    () =>
      activeProjectId
        ? listPrompts(activeProjectId)
        : Promise.resolve([] as PromptEntry[]),
    [activeProjectId],
  )
  const characters = useLiveQuery(
    () =>
      activeProjectId
        ? db.characters.where('projectId').equals(activeProjectId).sortBy('name')
        : Promise.resolve([] as Character[]),
    [activeProjectId],
  )

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('todos')
  const [modelFilter, setModelFilter] = useState<string>('todos')
  const [characterFilter, setCharacterFilter] = useState<string>('todos')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('fecha-desc')

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptEntry | null>(null)
  const [promptToDelete, setPromptToDelete] = useState<PromptEntry | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const models = useMemo(() => {
    const set = new Set<string>()
    for (const p of prompts ?? []) if (p.aiModel.trim()) set.add(p.aiModel.trim())
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [prompts])

  const filteredPrompts = useMemo(() => {
    const list = prompts ?? []
    const query = search.trim().toLowerCase()
    const filtered = list.filter((p) => {
      const haystack = [
        p.name,
        p.content,
        p.description,
        p.aiModel,
        p.platform,
        p.generationType,
        p.language,
        p.negativePrompt,
        p.technicalParams,
        ...p.tags,
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !query || haystack.includes(query)
      const matchesCategory = categoryFilter === 'todos' || p.category === categoryFilter
      const matchesModel = modelFilter === 'todos' || p.aiModel.trim() === modelFilter
      const matchesCharacter =
        characterFilter === 'todos' || p.characterIds.includes(characterFilter)
      const matchesFavorite = !favoritesOnly || p.isFavorite
      return (
        matchesSearch && matchesCategory && matchesModel && matchesCharacter && matchesFavorite
      )
    })
    const sorted = [...filtered]
    if (sortMode === 'fecha-desc') sorted.sort((a, b) => b.createdAt - a.createdAt)
    if (sortMode === 'fecha-asc') sorted.sort((a, b) => a.createdAt - b.createdAt)
    if (sortMode === 'nombre') sorted.sort((a, b) => a.name.localeCompare(b.name))
    return sorted
  }, [prompts, search, categoryFilter, modelFilter, characterFilter, favoritesOnly, sortMode])

  const handleCopy = async (prompt: PromptEntry) => {
    const ok = await copyTextToClipboard(prompt.content)
    if (ok) {
      setCopiedId(prompt.id)
      setTimeout(() => setCopiedId((current) => (current === prompt.id ? null : current)), 2000)
    }
  }

  const handleDelete = async (prompt: PromptEntry) => {
    await deletePrompt(prompt.id)
    setPromptToDelete(null)
    if (selectedPromptId === prompt.id) setSelectedPromptId(null)
  }

  const openCreate = () => {
    setEditingPrompt(null)
    setFormOpen(true)
  }
  const openEdit = (prompt: PromptEntry) => {
    setEditingPrompt(prompt)
    setFormOpen(true)
  }

  if (!activeProjectId) {
    return (
      <EmptyState
        title="No hay proyecto activo"
        description="Selecciona o crea un proyecto para ver y gestionar su biblioteca de prompts."
      />
    )
  }

  const selectedPrompt = selectedPromptId
    ? (prompts ?? []).find((p) => p.id === selectedPromptId) ?? null
    : null

  if (selectedPrompt) {
    return (
      <div className="space-y-6 p-6">
        <PromptDetail
          prompt={selectedPrompt}
          projectId={activeProjectId}
          copied={copiedId === selectedPrompt.id}
          onBack={() => setSelectedPromptId(null)}
          onCopy={() => void handleCopy(selectedPrompt)}
          onEdit={() => openEdit(selectedPrompt)}
          onDuplicate={() => void duplicatePrompt(selectedPrompt.id)}
          onDelete={() => setPromptToDelete(selectedPrompt)}
          onToggleFavorite={() => void togglePromptFavorite(selectedPrompt.id)}
        />
        <PromptForm
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={activeProjectId}
          prompt={editingPrompt}
          onSaved={(id) => setSelectedPromptId(id)}
        />
        <ConfirmDialog
          open={promptToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPromptToDelete(null)
          }}
          title={promptToDelete ? `Eliminar «${promptToDelete.name}»` : 'Eliminar prompt'}
          message="El prompt y todas sus variantes se eliminarán de este proyecto. Esta acción no se puede deshacer."
          onConfirm={() => {
            if (promptToDelete) void handleDelete(promptToDelete)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de prompts</h1>
          <p className="text-sm text-muted-foreground">
            {prompts === undefined
              ? 'Cargando…'
              : `${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'} en este proyecto`}
          </p>
        </div>
        <div className="flex-1" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo prompt
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, contenido, modelo, etiqueta…"
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las categorías</SelectItem>
            {PROMPT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los modelos</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={characterFilter} onValueChange={setCharacterFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Personaje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los personajes</SelectItem>
            {(characters ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fecha-desc">Más recientes</SelectItem>
            <SelectItem value="fecha-asc">Más antiguos</SelectItem>
            <SelectItem value="nombre">Por nombre</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="prompts-favorites-only"
            checked={favoritesOnly}
            onCheckedChange={setFavoritesOnly}
          />
          <Label htmlFor="prompts-favorites-only">Solo favoritos</Label>
        </div>
      </div>

      {prompts === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando prompts…</p>
      ) : prompts.length === 0 ? (
        <EmptyState
          title="Aún no hay prompts en este proyecto"
          description="Crea el primer prompt para guardar los textos que usas en las herramientas de IA: estilo de dibujo, escenarios, voces y más."
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo prompt
            </Button>
          }
        />
      ) : filteredPrompts.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ningún prompt coincide con la búsqueda o los filtros aplicados."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrompts.map((prompt) => (
            <Card
              key={prompt.id}
              className="flex cursor-pointer flex-col transition-colors hover:border-primary/50"
              onClick={() => setSelectedPromptId(prompt.id)}
            >
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{prompt.name}</CardTitle>
                  {prompt.isFavorite && (
                    <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
                <CardDescription>
                  <Badge variant="secondary">{PROMPT_CATEGORY_LABELS[prompt.category]}</Badge>{' '}
                  {prompt.aiModel && <Badge variant="outline">{prompt.aiModel}</Badge>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="line-clamp-3 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {prompt.description || prompt.content}
                </p>
                {prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    {prompt.tags.length > 4 && (
                      <Badge variant="outline">+{prompt.tags.length - 4}</Badge>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(prompt.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  {prompt.generationType ? ` · ${prompt.generationType}` : ''}
                  {prompt.language ? ` · ${prompt.language}` : ''}
                </p>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => void handleCopy(prompt)}
                  >
                    {copiedId === prompt.id ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(prompt)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void duplicatePrompt(prompt.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPromptToDelete(prompt)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromptForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={activeProjectId}
        prompt={editingPrompt}
        onSaved={(id) => setSelectedPromptId(id)}
      />
      <ConfirmDialog
        open={promptToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPromptToDelete(null)
        }}
        title={promptToDelete ? `Eliminar «${promptToDelete.name}»` : 'Eliminar prompt'}
        message="El prompt y todas sus variantes se eliminarán de este proyecto. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (promptToDelete) void handleDelete(promptToDelete)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detalle de un prompt                                                */
/* ------------------------------------------------------------------ */

function PromptDetail({
  prompt,
  projectId,
  copied,
  onBack,
  onCopy,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: {
  prompt: PromptEntry
  projectId: string
  copied: boolean
  onBack: () => void
  onCopy: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}) {
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const episodes = useLiveQuery(
    () => db.episodes.where('projectId').equals(projectId).sortBy('number'),
    [projectId],
  )
  const scenes = useLiveQuery(
    () =>
      prompt.episodeId
        ? db.scenes.where('episodeId').equals(prompt.episodeId).sortBy('number')
        : Promise.resolve([] as Scene[]),
    [prompt.episodeId],
  )
  const shots = useLiveQuery(
    () =>
      prompt.sceneId
        ? db.shots.where('sceneId').equals(prompt.sceneId).sortBy('number')
        : Promise.resolve([] as Shot[]),
    [prompt.sceneId],
  )
  const variants = useLiveQuery(() => listPromptVariants(prompt.id), [prompt.id])

  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<PromptVariant | null>(null)
  const [variantToDelete, setVariantToDelete] = useState<PromptVariant | null>(null)
  const [copiedVariantId, setCopiedVariantId] = useState<string | null>(null)

  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])
  const episode = (episodes ?? []).find((e) => e.id === prompt.episodeId)
  const scene = (scenes ?? []).find((s) => s.id === prompt.sceneId)
  const shot = (shots ?? []).find((s) => s.id === prompt.shotId)

  const imageUrls = useAssetUrlMap(prompt.imageAssetIds)
  const resultUrls = useAssetUrlMap(
    prompt.generatedResultAssetId ? [prompt.generatedResultAssetId] : [],
  )

  const handleCopyVariant = async (variant: PromptVariant) => {
    const ok = await copyTextToClipboard(variant.content)
    if (ok) {
      setCopiedVariantId(variant.id)
      setTimeout(
        () => setCopiedVariantId((cur) => (cur === variant.id ? null : cur)),
        2000,
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a prompts
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={onToggleFavorite}>
          <Star
            className={`mr-2 h-4 w-4 ${prompt.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
          />
          {prompt.isFavorite ? 'Favorito' : 'Marcar favorito'}
        </Button>
        <Button variant="outline" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar prompt
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
        <Button variant="outline" onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{prompt.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{PROMPT_CATEGORY_LABELS[prompt.category]}</Badge>
          {prompt.generationType && <Badge variant="secondary">{prompt.generationType}</Badge>}
          {prompt.aiModel && <Badge variant="outline">Modelo: {prompt.aiModel}</Badge>}
          {prompt.platform && <Badge variant="outline">Plataforma: {prompt.platform}</Badge>}
          {prompt.language && <Badge variant="outline">{prompt.language}</Badge>}
          {prompt.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Creado el{' '}
          {new Date(prompt.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          {prompt.updatedAt !== prompt.createdAt &&
            ` · última edición el ${new Date(prompt.updatedAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}`}
        </p>
      </div>

      {prompt.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{prompt.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido del prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {prompt.content}
          </pre>
        </CardContent>
      </Card>

      {prompt.negativePrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Negative prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{prompt.negativePrompt}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles técnicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <DetailRow label="Parámetros técnicos" value={prompt.technicalParams} />
          <DetailRow
            label="Duración"
            value={
              prompt.durationSeconds !== undefined ? `${prompt.durationSeconds} s` : ''
            }
          />
          <DetailRow label="Aspecto" value={prompt.aspectRatio} />
          <DetailRow label="Resolución" value={prompt.resolution} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Personajes</p>
            {prompt.characterIds.length === 0 ? (
              <p className="text-muted-foreground">Sin personajes relacionados.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {prompt.characterIds.map((id) => {
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
          </div>
          <div>
            <p className="font-medium">Episodio / escena / plano</p>
            {!episode && !scene && !shot ? (
              <p className="text-muted-foreground">Sin episodio, escena ni plano.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {episode && (
                  <Badge variant="secondary">
                    Ep. {episode.number}
                    {episode.title ? ` — ${episode.title}` : ''}
                  </Badge>
                )}
                {scene && (
                  <Badge variant="secondary">
                    Escena {scene.number}
                    {scene.title ? ` — ${scene.title}` : ''}
                  </Badge>
                )}
                {shot && <Badge variant="secondary">Plano {shot.number}</Badge>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {prompt.imageAssetIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imágenes de referencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {prompt.imageAssetIds.map((assetId) => (
                <div
                  key={assetId}
                  className="aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {imageUrls[assetId] ? (
                    <img
                      src={imageUrls[assetId]}
                      alt="Imagen de referencia"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {prompt.generatedResultAssetId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado generado</CardTitle>
          </CardHeader>
          <CardContent>
            {resultUrls[prompt.generatedResultAssetId] ? (
              <img
                src={resultUrls[prompt.generatedResultAssetId]}
                alt="Resultado generado con este prompt"
                className="max-h-96 rounded-md border object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                El archivo del resultado ya no está disponible en el proyecto.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-base">
              Variantes ({variants === undefined ? '…' : variants.length})
            </CardTitle>
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={() => {
                setEditingVariant(null)
                setVariantFormOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva variante
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {variants === undefined ? (
            <p className="text-sm text-muted-foreground">Cargando variantes…</p>
          ) : variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este prompt aún no tiene variantes. Crea una para probar un
              ajuste sin tocar el original.
            </p>
          ) : (
            variants.map((variant) => (
              <div key={variant.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{variant.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(variant.createdAt).toLocaleDateString('es-ES')}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyVariant(variant)}
                  >
                    {copiedVariantId === variant.id ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingVariant(variant)
                      setVariantFormOpen(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVariantToDelete(variant)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {variant.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{variant.note}</p>
                )}
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm">
                  {variant.content}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <PromptVariantForm
        open={variantFormOpen}
        onOpenChange={setVariantFormOpen}
        projectId={projectId}
        promptId={prompt.id}
        baseContent={prompt.content}
        variant={editingVariant}
      />
      <ConfirmDialog
        open={variantToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setVariantToDelete(null)
        }}
        title={variantToDelete ? `Eliminar variante «${variantToDelete.name}»` : 'Eliminar variante'}
        message="La variante se eliminará. El prompt original no se toca. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (variantToDelete) {
            await deletePromptVariant(variantToDelete.id)
            setVariantToDelete(null)
          }
        }}
      />
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null
  return (
    <p>
      <span className="font-medium">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  )
}
