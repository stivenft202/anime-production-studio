import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { db, type LoreEntry, type TimelineEvent } from '../db/db'
import {
  deleteLoreEntry,
  deleteTimelineEvent,
  duplicateLoreEntry,
  duplicateTimelineEvent,
  listLoreEntries,
  listTimelineEvents,
  LORE_ENTRY_TYPE_LABELS,
  LORE_ENTRY_TYPES,
  moveTimelineEvent,
} from '../lib/lore'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { useAssetUrlMap } from '../components/characters/useAssetUrls'
import { LoreEntryForm } from '../components/lore/LoreEntryForm'
import { TimelineEventForm } from '../components/lore/TimelineEventForm'

type SpoilerFilter = 'todos' | 'solo-spoilers' | 'ocultar-spoilers'

export function Lore() {
  const activeProjectId = useAppStore((s) => s.activeProjectId)

  const entries = useLiveQuery(
    () =>
      activeProjectId
        ? listLoreEntries(db, activeProjectId)
        : Promise.resolve([] as LoreEntry[]),
    [activeProjectId],
  )
  const events = useLiveQuery(
    () =>
      activeProjectId
        ? listTimelineEvents(db, activeProjectId)
        : Promise.resolve([] as TimelineEvent[]),
    [activeProjectId],
  )

  const [tab, setTab] = useState<'entradas' | 'cronologia'>('entradas')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('todos')
  const [spoilerFilter, setSpoilerFilter] = useState<SpoilerFilter>('todos')

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [entryFormOpen, setEntryFormOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<LoreEntry | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<LoreEntry | null>(null)

  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null)
  const [eventToDelete, setEventToDelete] = useState<TimelineEvent | null>(null)

  const filteredEntries = useMemo(() => {
    const list = entries ?? []
    const query = search.trim().toLowerCase()
    return list.filter((e) => {
      const haystack = [e.title, e.description, e.history, e.features, e.rules, ...e.tags]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !query || haystack.includes(query)
      const matchesType = typeFilter === 'todos' || e.type === typeFilter
      const matchesSpoiler =
        spoilerFilter === 'todos' ||
        (spoilerFilter === 'solo-spoilers' && e.spoiler) ||
        (spoilerFilter === 'ocultar-spoilers' && !e.spoiler)
      return matchesSearch && matchesType && matchesSpoiler
    })
  }, [entries, search, typeFilter, spoilerFilter])

  if (!activeProjectId) {
    return (
      <EmptyState
        title="No hay proyecto activo"
        description="Selecciona o crea un proyecto para ver y gestionar su universo y su lore."
      />
    )
  }

  const selectedEntry = selectedEntryId
    ? (entries ?? []).find((e) => e.id === selectedEntryId) ?? null
    : null

  const openCreateEntry = () => {
    setEditingEntry(null)
    setEntryFormOpen(true)
  }
  const openEditEntry = (entry: LoreEntry) => {
    setEditingEntry(entry)
    setEntryFormOpen(true)
  }
  const openCreateEvent = () => {
    setEditingEvent(null)
    setEventFormOpen(true)
  }
  const openEditEvent = (event: TimelineEvent) => {
    setEditingEvent(event)
    setEventFormOpen(true)
  }

  const handleDeleteEntry = async (entry: LoreEntry) => {
    await deleteLoreEntry(db, entry.id)
    setEntryToDelete(null)
    if (selectedEntryId === entry.id) setSelectedEntryId(null)
  }
  const handleDeleteEvent = async (event: TimelineEvent) => {
    await deleteTimelineEvent(db, event.id)
    setEventToDelete(null)
  }

  // Vista detalle de una entrada
  if (selectedEntry) {
    return (
      <div className="space-y-6 p-6">
        <LoreEntryDetail
          entry={selectedEntry}
          projectId={activeProjectId}
          onBack={() => setSelectedEntryId(null)}
          onEdit={() => openEditEntry(selectedEntry)}
          onDuplicate={() => void duplicateLoreEntry(db, selectedEntry.id)}
          onDelete={() => setEntryToDelete(selectedEntry)}
        />
        <LoreEntryForm
          open={entryFormOpen}
          onOpenChange={setEntryFormOpen}
          projectId={activeProjectId}
          entry={editingEntry}
          onSaved={(id) => setSelectedEntryId(id)}
        />
        <ConfirmDialog
          open={entryToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setEntryToDelete(null)
          }}
          title={entryToDelete ? `Eliminar «${entryToDelete.title}»` : 'Eliminar entrada'}
          message="La entrada de lore se eliminará de este proyecto. Esta acción no se puede deshacer."
          onConfirm={() => {
            if (entryToDelete) void handleDeleteEntry(entryToDelete)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Universo y lore</h1>
          <p className="text-sm text-muted-foreground">
            {entries === undefined || events === undefined
              ? 'Cargando…'
              : `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'} · ${events.length} ${events.length === 1 ? 'acontecimiento' : 'acontecimientos'} en la cronología`}
          </p>
        </div>
        <div className="flex-1" />
        {tab === 'entradas' ? (
          <Button onClick={openCreateEntry}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva entrada
          </Button>
        ) : (
          <Button onClick={openCreateEvent}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo acontecimiento
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'entradas' | 'cronologia')}>
        <TabsList>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="cronologia">Cronología</TabsTrigger>
        </TabsList>

        <TabsContent value="entradas" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, descripción, historia o etiqueta…"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {LORE_ENTRY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={spoilerFilter}
              onValueChange={(v) => setSpoilerFilter(v as SpoilerFilter)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Spoilers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos (con spoilers)</SelectItem>
                <SelectItem value="solo-spoilers">Solo spoilers</SelectItem>
                <SelectItem value="ocultar-spoilers">Ocultar spoilers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entries === undefined ? (
            <p className="text-sm text-muted-foreground">Cargando entradas…</p>
          ) : entries.length === 0 ? (
            <EmptyState
              title="Aún no hay entradas de lore en este proyecto"
              description="Crea la primera entrada para empezar a construir el universo: su historia, sus reglas, sus facciones y sus misterios."
              action={
                <Button onClick={openCreateEntry}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva entrada
                </Button>
              }
            />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ninguna entrada coincide con la búsqueda o los filtros aplicados."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEntries.map((entry) => (
                <Card
                  key={entry.id}
                  className="flex cursor-pointer flex-col transition-colors hover:border-primary/50"
                  onClick={() => setSelectedEntryId(entry.id)}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{entry.title}</CardTitle>
                      {entry.spoiler && <Badge variant="destructive">SPOILER</Badge>}
                    </div>
                    <CardDescription>
                      <Badge variant="secondary">{LORE_ENTRY_TYPE_LABELS[entry.type]}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                      {entry.description || 'Sin descripción.'}
                    </p>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {entry.tags.length > 4 && (
                          <Badge variant="outline">+{entry.tags.length - 4}</Badge>
                        )}
                      </div>
                    )}
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditEntry(entry)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void duplicateLoreEntry(db, entry.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEntryToDelete(entry)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cronologia" className="space-y-4">
          {events === undefined ? (
            <p className="text-sm text-muted-foreground">Cargando cronología…</p>
          ) : events.length === 0 ? (
            <EmptyState
              title="La cronología está vacía"
              description="Añade acontecimientos para ordenar la historia del universo: qué ocurrió, cuándo y qué consecuencias tuvo."
              action={
                <Button onClick={openCreateEvent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo acontecimiento
                </Button>
              }
            />
          ) : (
            <TimelineList
              events={events}
              projectId={activeProjectId}
              onEdit={openEditEvent}
              onDelete={setEventToDelete}
            />
          )}
        </TabsContent>
      </Tabs>

      <LoreEntryForm
        open={entryFormOpen}
        onOpenChange={setEntryFormOpen}
        projectId={activeProjectId}
        entry={editingEntry}
        onSaved={(id) => setSelectedEntryId(id)}
      />
      <TimelineEventForm
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        projectId={activeProjectId}
        event={editingEvent}
      />
      <ConfirmDialog
        open={entryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setEntryToDelete(null)
        }}
        title={entryToDelete ? `Eliminar «${entryToDelete.title}»` : 'Eliminar entrada'}
        message="La entrada de lore se eliminará de este proyecto. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (entryToDelete) void handleDeleteEntry(entryToDelete)
        }}
      />
      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setEventToDelete(null)
        }}
        title={eventToDelete ? `Eliminar «${eventToDelete.title}»` : 'Eliminar acontecimiento'}
        message="El acontecimiento se eliminará de la cronología. Esta acción no se puede deshacer."
        onConfirm={() => {
          if (eventToDelete) void handleDeleteEvent(eventToDelete)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detalle de una entrada                                              */
/* ------------------------------------------------------------------ */

function LoreEntryDetail({
  entry,
  projectId,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: LoreEntry
  projectId: string
  onBack: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const setSection = useAppStore((s) => s.setSection)
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const episodes = useLiveQuery(
    () => db.episodes.where('projectId').equals(projectId).sortBy('number'),
    [projectId],
  )
  const urls = useAssetUrlMap(entry.imageAssetIds)

  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al lore
        </Button>
        <div className="flex-1" />
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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{entry.title}</h1>
          {entry.spoiler && (
            <Badge variant="destructive">
              <EyeOff className="mr-1 h-3 w-3" />
              SPOILER
            </Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{LORE_ENTRY_TYPE_LABELS[entry.type]}</Badge>
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <DetailSection title="Descripción" text={entry.description} />
      <DetailSection title="Historia" text={entry.history} />
      <DetailSection title="Características" text={entry.features} />
      <DetailSection title="Reglas" text={entry.rules} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Personajes</p>
            {entry.characterIds.length === 0 ? (
              <p className="text-muted-foreground">Sin personajes relacionados.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {entry.characterIds.map((id) => {
                  const name = characterById.get(id)
                  if (!name) return null
                  return (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSection('personajes')}
                    >
                      {name}
                    </Button>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Al pulsar un personaje se abre la sección Personajes.
            </p>
          </div>
          <div>
            <p className="font-medium">Lugares</p>
            {entry.locationNames.length === 0 ? (
              <p className="text-muted-foreground">Sin lugares.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {entry.locationNames.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Los lugares detallados llegan en la fase 5.
            </p>
          </div>
          <div>
            <p className="font-medium">Episodios</p>
            {entry.episodeNumbers.length === 0 ? (
              <p className="text-muted-foreground">Sin episodios relacionados.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {entry.episodeNumbers.map((n) => {
                  const episode = (episodes ?? []).find((e) => e.number === n)
                  const label = episode
                    ? episode.title.trim()
                      ? `Episodio ${episode.number} — ${episode.title}`
                      : `Episodio ${episode.number} (sin título)`
                    : `Episodio ${n}`
                  return (
                    <Button
                      key={n}
                      variant="outline"
                      size="sm"
                      onClick={() => setSection('guiones')}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Al pulsar un episodio se abre la sección Guiones.
            </p>
          </div>
        </CardContent>
      </Card>

      {entry.imageAssetIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imágenes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {entry.imageAssetIds.map((assetId) => (
                <div
                  key={assetId}
                  className="aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {urls[assetId] ? (
                    <img
                      src={urls[assetId]}
                      alt="Imagen del lore"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DetailSection({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm">{text}</p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Cronología: línea vertical agrupada por era                         */
/* ------------------------------------------------------------------ */

function TimelineList({
  events,
  projectId,
  onEdit,
  onDelete,
}: {
  events: TimelineEvent[]
  projectId: string
  onEdit: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => void
}) {
  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  )
  const characterById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of characters ?? []) map.set(c.id, c.name)
    return map
  }, [characters])

  let lastEra: string | null = null

  return (
    <ol className="relative space-y-6 border-l-2 border-border pl-6">
      {events.map((event, index) => {
        const showEraHeader = (event.era || 'Sin era') !== lastEra
        lastEra = event.era || 'Sin era'
        const isFirst = index === 0
        const isLast = index === events.length - 1
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[31px] top-1.5 size-3 rounded-full border-2 border-primary bg-background" />
            {showEraHeader && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {event.era || 'Sin era'}
              </p>
            )}
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  {event.spoiler && <Badge variant="destructive">SPOILER</Badge>}
                </div>
                <CardDescription>
                  {event.fictionalDate || 'Sin fecha ficticia'}
                  {event.era ? ` · ${event.era}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.description && <p className="text-sm">{event.description}</p>}
                {event.consequences && (
                  <p className="text-sm">
                    <span className="font-medium">Consecuencias: </span>
                    <span className="text-muted-foreground">{event.consequences}</span>
                  </p>
                )}
                {event.characterIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {event.characterIds.map((id) => {
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
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFirst}
                    onClick={() => void moveTimelineEvent(db, event.id, -1)}
                    title="Subir en la cronología"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLast}
                    onClick={() => void moveTimelineEvent(db, event.id, 1)}
                    title="Bajar en la cronología"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void duplicateTimelineEvent(db, event.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDelete(event)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}
