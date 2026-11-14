import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderKanban, ImagePlus, Pencil, Plus, Trash2, Upload, Users, X } from 'lucide-react'
import { db, type Project } from '../db/db'
import { useAppStore } from '../store/appStore'
import { deleteCharacterCascade } from '../lib/characters'
import { deleteAssetFile, saveAssetFile, type AssetRef } from '../lib/files'
import { useAssetUrlMap } from '../components/characters/useAssetUrls'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Label } from '../components/ui/Label'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent } from '../components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'

const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'en-produccion', label: 'En producción' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'completado', label: 'Completado' },
  { value: 'archivado', label: 'Archivado' },
] as const

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  'en-produccion': 'En producción',
  pausado: 'Pausado',
  completado: 'Completado',
  archivado: 'Archivado',
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'en-produccion':
      return 'default'
    case 'completado':
      return 'secondary'
    case 'idea':
      return 'secondary'
    default:
      return 'outline'
  }
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp))
}

interface ProjectFormState {
  name: string
  description: string
  genre: string
  synopsis: string
  status: string
  language: string
  tags: string[]
  team: string[]
  socialLinks: { label: string; url: string }[]
}

const emptyForm: ProjectFormState = {
  name: '',
  description: '',
  genre: '',
  synopsis: '',
  status: 'idea',
  language: 'español',
  tags: [],
  team: [],
  socialLinks: [],
}

function formFromProject(project: Project): ProjectFormState {
  return {
    name: project.name,
    description: project.description ?? '',
    genre: project.genre ?? '',
    synopsis: project.synopsis ?? '',
    status: project.status || 'idea',
    language: project.language ?? 'español',
    tags: [...(project.tags ?? [])],
    team: [...(project.team ?? [])],
    socialLinks: (project.socialLinks ?? []).map((link) => ({ ...link })),
  }
}

/**
 * Borra el archivo de un asset solo si ningún personaje lo referencia
 * (galería o vestimentas). El logo y la portada solo los referencia el
 * propio proyecto, pero esta comprobación evita romper un personaje
 * que compartiera el mismo archivo.
 */
async function deleteAssetIfUnusedByCharacters(assetId: string): Promise<void> {
  const usedByImage = await db.characterImages.where('assetId').equals(assetId).count()
  if (usedByImage > 0) return
  const outfits = await db.characterOutfits.toArray()
  if (outfits.some((outfit) => outfit.imageIds.includes(assetId))) return
  const asset = await db.assets.get(assetId)
  if (!asset) return
  try {
    await deleteAssetFile(asset as unknown as AssetRef)
  } catch {
    // El archivo ya no existe o no se pudo borrar: no bloquea el guardado.
  }
}

/** Selector de imagen (logo o portada) con vista previa. */
function ImagePicker({
  label,
  hint,
  currentUrl,
  wide,
  onFileChange,
  onRemove,
}: {
  label: string
  hint: string
  currentUrl: string | null
  wide: boolean
  onFileChange: (file: File | null) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shownUrl = preview ?? currentUrl

  function handleSelect(selected: File | null) {
    setFile(selected)
    onFileChange(selected)
  }

  function handleRemove() {
    setFile(null)
    onFileChange(null)
    onRemove()
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {shownUrl ? (
        <div className={wide ? 'relative aspect-video w-full overflow-hidden rounded-md border' : 'relative size-24 overflow-hidden rounded-md border'}>
          <img src={shownUrl} alt={label} className="size-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute right-2 top-2"
            onClick={handleRemove}
          >
            Quitar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={
            wide
              ? 'flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent'
              : 'flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-accent'
          }
        >
          <ImagePlus className="size-5" />
          {hint}
        </button>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload />
          {shownUrl ? 'Cambiar imagen' : 'Subir imagen'}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleSelect(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
    </div>
  )
}

export function Projects() {
  const { activeProjectId, setActiveProjectId, setSection, newProjectSignal } = useAppStore()
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])

  const assetIds = useMemo(() => {
    const ids: string[] = []
    for (const project of projects ?? []) {
      if (project.coverAssetId) ids.push(project.coverAssetId)
      if (project.logoAssetId) ids.push(project.logoAssetId)
    }
    return ids
  }, [projects])
  const assetUrls = useAssetUrlMap(assetIds)

  const characterCountByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const character of characters ?? []) {
      counts.set(character.projectId, (counts.get(character.projectId) ?? 0) + 1)
    }
    return counts
  }, [characters])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectFormState>(emptyForm)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)

  const [tagInput, setTagInput] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const [linkLabelInput, setLinkLabelInput] = useState('')
  const [linkUrlInput, setLinkUrlInput] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  function resetFormState() {
    setForm(emptyForm)
    setNameError(null)
    setSaveError(null)
    setLogoFile(null)
    setLogoRemoved(false)
    setCoverFile(null)
    setCoverRemoved(false)
    setTagInput('')
    setMemberInput('')
    setLinkLabelInput('')
    setLinkUrlInput('')
    setLinkError(null)
  }

  function openCreate() {
    setEditing(null)
    resetFormState()
    setDialogOpen(true)
  }

  // Señal del menú "Archivo > Nuevo proyecto": abre el diálogo de crear.
  useEffect(() => {
    if (newProjectSignal > 0) openCreate()
    // Solo reacciona al cambio de la señal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProjectSignal])

  function openEdit(project: Project) {
    setEditing(project)
    resetFormState()
    setForm(formFromProject(project))
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  function addTag(raw: string) {
    const value = raw.trim().replace(/,$/, '').trim()
    if (!value) return
    setForm((prev) =>
      prev.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())
        ? prev
        : { ...prev, tags: [...prev.tags, value] },
    )
  }

  function addMember() {
    const value = memberInput.trim()
    if (!value) return
    setForm((prev) =>
      prev.team.some((member) => member.toLowerCase() === value.toLowerCase())
        ? prev
        : { ...prev, team: [...prev.team, value] },
    )
    setMemberInput('')
  }

  function addSocialLink() {
    const label = linkLabelInput.trim()
    const rawUrl = linkUrlInput.trim()
    if (!label || !rawUrl) {
      setLinkError('Escribe una etiqueta y una URL para añadir la red social.')
      return
    }
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    try {
      new URL(url)
    } catch {
      setLinkError('La URL no es válida. Revisa el enlace e inténtalo de nuevo.')
      return
    }
    setForm((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, { label, url }] }))
    setLinkLabelInput('')
    setLinkUrlInput('')
    setLinkError(null)
  }

  function activateProject(project: Project) {
    setActiveProjectId(project.id)
    setSection('inicio')
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setNameError('El nombre es obligatorio.')
      return
    }
    setNameError(null)
    setSaving(true)
    setSaveError(null)
    try {
      const projectId = editing ? editing.id : crypto.randomUUID()
      const now = Date.now()

      let logoAssetId = editing?.logoAssetId
      let coverAssetId = editing?.coverAssetId

      if (logoFile) {
        const ref = await saveAssetFile(logoFile, projectId)
        if (editing?.logoAssetId && editing.logoAssetId !== ref.id) {
          await deleteAssetIfUnusedByCharacters(editing.logoAssetId)
        }
        logoAssetId = ref.id
      } else if (logoRemoved && editing?.logoAssetId) {
        await deleteAssetIfUnusedByCharacters(editing.logoAssetId)
        logoAssetId = undefined
      }

      if (coverFile) {
        const ref = await saveAssetFile(coverFile, projectId)
        if (editing?.coverAssetId && editing.coverAssetId !== ref.id) {
          await deleteAssetIfUnusedByCharacters(editing.coverAssetId)
        }
        coverAssetId = ref.id
      } else if (coverRemoved && editing?.coverAssetId) {
        await deleteAssetIfUnusedByCharacters(editing.coverAssetId)
        coverAssetId = undefined
      }

      const common = {
        name,
        description: form.description.trim(),
        genre: form.genre.trim(),
        synopsis: form.synopsis.trim(),
        status: form.status,
        language: form.language.trim() || 'español',
        tags: form.tags,
        team: form.team,
        socialLinks: form.socialLinks,
      }

      if (editing) {
        await db.projects.put({
          ...editing,
          ...common,
          logoAssetId,
          coverAssetId,
          updatedAt: now,
        })
      } else {
        await db.projects.add({
          id: projectId,
          ...common,
          ...(logoAssetId ? { logoAssetId } : {}),
          ...(coverAssetId ? { coverAssetId } : {}),
          createdAt: now,
          updatedAt: now,
        })
        setActiveProjectId(projectId)
      }
      closeDialog()
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? `No se pudo guardar el proyecto: ${error.message}`
          : 'No se pudo guardar el proyecto.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!projectToDelete) return
    const projectId = projectToDelete.id
    try {
      // Personajes en cascada (imágenes, vestimentas y relaciones de cada uno).
      const projectCharacters = await db.characters.where('projectId').equals(projectId).toArray()
      for (const character of projectCharacters) {
        try {
          await deleteCharacterCascade(db, character.id)
        } catch {
          // Seguir con el resto aunque un personaje falle.
        }
      }
      // Relaciones huérfanas del proyecto y resto de assets (logo, portada).
      await db.characterRelationships.where('projectId').equals(projectId).delete()
      const assets = await db.assets.where('projectId').equals(projectId).toArray()
      for (const asset of assets) {
        try {
          await deleteAssetFile(asset as unknown as AssetRef)
        } catch {
          // El archivo ya no existe: no bloquea la eliminación.
        }
      }
      await db.projects.delete(projectId)
      if (activeProjectId === projectId) {
        const remaining = await db.projects.orderBy('updatedAt').reverse().toArray()
        setActiveProjectId(remaining[0]?.id ?? null)
      }
    } finally {
      setProjectToDelete(null)
    }
  }

  const projectList = projects ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {projectList.length === 0
              ? 'Todavía no hay proyectos.'
              : `${projectList.length} ${projectList.length === 1 ? 'proyecto' : 'proyectos'} en la base de datos local.`}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nuevo proyecto
        </Button>
      </div>

      {projectList.length === 0 ? (
        <EmptyState
          title="Sin proyectos"
          description="Crea tu primer proyecto de anime para empezar a gestionar sus personajes, lore y episodios."
          action={
            <Button onClick={openCreate}>
              <Plus />
              Crear proyecto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projectList.map((project) => {
            const isActive = project.id === activeProjectId
            const coverUrl = project.coverAssetId ? assetUrls[project.coverAssetId] : undefined
            const characterCount = characterCountByProject.get(project.id) ?? 0
            const initial = project.name.trim().charAt(0).toUpperCase() || '?'
            return (
              <Card key={project.id} className={isActive ? 'ring-2 ring-primary' : undefined}>
                <button
                  type="button"
                  onClick={() => activateProject(project)}
                  className="block w-full text-left"
                  title="Abrir proyecto"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`Portada de ${project.name}`}
                      className="aspect-video w-full rounded-t-lg object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-t-lg bg-muted">
                      <span className="text-5xl font-bold text-muted-foreground">{initial}</span>
                    </div>
                  )}
                </button>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => activateProject(project)}
                      className="min-w-0 text-left"
                      title="Abrir proyecto"
                    >
                      <h2 className="truncate text-base font-semibold leading-tight hover:underline">
                        {project.name}
                      </h2>
                    </button>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {isActive && <Badge>Activo</Badge>}
                      <Badge variant={statusBadgeVariant(project.status)}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </div>
                  </div>

                  {project.genre ? (
                    <p className="text-sm text-muted-foreground">{project.genre}</p>
                  ) : null}
                  {project.synopsis ? (
                    <p className="line-clamp-2 text-sm">{project.synopsis}</p>
                  ) : project.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                  ) : null}

                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                      {project.tags.length > 4 && (
                        <Badge variant="outline">+{project.tags.length - 4}</Badge>
                      )}
                    </div>
                  )}

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {characterCount} {characterCount === 1 ? 'personaje' : 'personajes'}
                    <span aria-hidden="true">·</span>
                    Modificado el {formatDate(project.updatedAt)}
                  </p>

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {!isActive && (
                      <Button size="sm" onClick={() => activateProject(project)}>
                        Activar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                      <Pencil />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setProjectToDelete(project)}
                    >
                      <Trash2 />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Modifica los datos de «${editing.name}».`
                : 'Completa los datos del proyecto. Solo el nombre es obligatorio.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nombre *</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                  if (nameError) setNameError(null)
                }}
                placeholder="Nombre del proyecto"
                aria-invalid={nameError ? true : undefined}
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-genre">Género</Label>
                <Input
                  id="project-genre"
                  value={form.genre}
                  onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
                  placeholder="p. ej. Ciencia ficción / Aventura"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-language">Idioma principal</Label>
                <Input
                  id="project-language"
                  value={form.language}
                  onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                  placeholder="español"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-status">Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="project-status">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Descripción</Label>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descripción breve del proyecto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-synopsis">Sinopsis</Label>
              <Textarea
                id="project-synopsis"
                value={form.synopsis}
                onChange={(event) => setForm((prev) => ({ ...prev, synopsis: event.target.value }))}
                placeholder="Resumen de la historia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-tags">Etiquetas</Label>
              <Input
                id="project-tags"
                value={tagInput}
                onChange={(event) => {
                  const value = event.target.value
                  if (value.includes(',')) {
                    const parts = value.split(',')
                    parts.slice(0, -1).forEach(addTag)
                    setTagInput(parts[parts.length - 1])
                  } else {
                    setTagInput(value)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addTag(tagInput)
                    setTagInput('')
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) {
                    addTag(tagInput)
                    setTagInput('')
                  }
                }}
                placeholder="Escribe una etiqueta y pulsa Enter o coma"
              />
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        aria-label={`Quitar etiqueta ${tag}`}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
                        }
                        className="rounded-full hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-team">Equipo</Label>
              <div className="flex gap-2">
                <Input
                  id="project-team"
                  value={memberInput}
                  onChange={(event) => setMemberInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addMember()
                    }
                  }}
                  placeholder="Nombre de un miembro del equipo"
                />
                <Button type="button" variant="outline" onClick={addMember}>
                  Añadir
                </Button>
              </div>
              {form.team.length > 0 && (
                <ul className="space-y-1">
                  {form.team.map((member) => (
                    <li
                      key={member}
                      className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span>{member}</span>
                      <button
                        type="button"
                        aria-label={`Quitar a ${member}`}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, team: prev.team.filter((m) => m !== member) }))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label>Redes sociales</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={linkLabelInput}
                  onChange={(event) => setLinkLabelInput(event.target.value)}
                  placeholder="Etiqueta (p. ej. YouTube)"
                  aria-label="Etiqueta de la red social"
                />
                <Input
                  value={linkUrlInput}
                  onChange={(event) => setLinkUrlInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addSocialLink()
                    }
                  }}
                  placeholder="URL (p. ej. youtube.com/...)"
                  aria-label="URL de la red social"
                />
                <Button type="button" variant="outline" onClick={addSocialLink} className="shrink-0">
                  Añadir
                </Button>
              </div>
              {linkError && <p className="text-sm text-destructive">{linkError}</p>}
              {form.socialLinks.length > 0 && (
                <ul className="space-y-1">
                  {form.socialLinks.map((link, index) => (
                    <li
                      key={`${link.label}-${link.url}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{link.label}: </span>
                        <span className="truncate text-muted-foreground">{link.url}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar enlace ${link.label}`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            socialLinks: prev.socialLinks.filter((_, i) => i !== index),
                          }))
                        }
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ImagePicker
                label="Logo"
                hint="Subir logo"
                currentUrl={
                  logoRemoved
                    ? null
                    : editing?.logoAssetId
                      ? (assetUrls[editing.logoAssetId] ?? null)
                      : null
                }
                wide={false}
                onFileChange={(file) => {
                  setLogoFile(file)
                  if (file) setLogoRemoved(false)
                }}
                onRemove={() => setLogoRemoved(true)}
              />
              <ImagePicker
                label="Portada"
                hint="Subir portada"
                currentUrl={
                  coverRemoved
                    ? null
                    : editing?.coverAssetId
                      ? (assetUrls[editing.coverAssetId] ?? null)
                      : null
                }
                wide
                onFileChange={(file) => {
                  setCoverFile(file)
                  if (file) setCoverRemoved(false)
                }}
                onRemove={() => setCoverRemoved(true)}
              />
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear proyecto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
        }}
        title="Eliminar proyecto"
        message={
          projectToDelete
            ? `¿Eliminar «${projectToDelete.name}»? Se borrarán también sus personajes, imágenes, vestimentas, relaciones y archivos. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={handleDeleteConfirmed}
      />

      {projectList.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderKanban className="size-3.5" />
          Haz clic en una tarjeta para abrir el proyecto. El proyecto activo es el que se usa en
          el resto de secciones.
        </p>
      )}
    </div>
  )
}
