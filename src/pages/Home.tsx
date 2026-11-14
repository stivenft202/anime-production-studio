import { useLiveQuery } from 'dexie-react-hooks'
import { FolderKanban, Images, Settings, Users, Waypoints } from 'lucide-react'
import { db } from '../db/db'
import { useAppStore } from '../store/appStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

export function Home() {
  const { activeProjectId, setActiveProjectId, setSection } = useAppStore()

  const activeProject = useLiveQuery(
    () => db.projects.get(activeProjectId ?? ''),
    [activeProjectId],
  )
  const characterCount = useLiveQuery(
    () => db.characters.where('projectId').equals(activeProjectId ?? '').count(),
    [activeProjectId],
  )
  const assetCount = useLiveQuery(
    () => db.assets.where('projectId').equals(activeProjectId ?? '').count(),
    [activeProjectId],
  )
  const relationshipCount = useLiveQuery(
    () => db.characterRelationships.where('projectId').equals(activeProjectId ?? '').count(),
    [activeProjectId],
  )
  const projectCount = useLiveQuery(() => db.projects.count(), [])
  const recentProjects = useLiveQuery(
    () => db.projects.orderBy('updatedAt').reverse().limit(5).toArray(),
    [],
  )

  const stats = [
    { label: 'Personajes', value: characterCount ?? 0, icon: Users },
    { label: 'Archivos', value: assetCount ?? 0, icon: Images },
    { label: 'Relaciones', value: relationshipCount ?? 0, icon: Waypoints },
    { label: 'Proyectos', value: projectCount ?? 0, icon: FolderKanban },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          {activeProject
            ? `Proyecto activo: ${activeProject.name}`
            : 'Selecciona un proyecto para ver sus datos.'}
        </p>
      </div>

      {!activeProject ? (
        <EmptyState
          title="No hay proyecto activo"
          description="Crea o selecciona un proyecto para empezar a trabajar."
          action={<Button onClick={() => setSection('proyectos')}>Ir a Proyectos</Button>}
        />
      ) : (
        <>
          {/* Resumen del proyecto activo */}
          <Card>
            <CardHeader>
              <CardTitle>{activeProject.name}</CardTitle>
              <CardDescription>
                {activeProject.genre ? `${activeProject.genre} · ` : ''}
                {activeProject.language ? `Idioma: ${activeProject.language}` : ''}
              </CardDescription>
            </CardHeader>
            {activeProject.synopsis ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">{activeProject.synopsis}</p>
              </CardContent>
            ) : null}
          </Card>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-2xl font-bold leading-none">{s.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Accesos rápidos */}
          <div>
            <h2 className="mb-3 text-sm font-semibold">Accesos rápidos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => setSection('personajes')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" /> Personajes
                  </CardTitle>
                  <CardDescription>Ver y gestionar los personajes del proyecto.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => setSection('proyectos')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderKanban className="size-4 text-primary" /> Proyectos
                  </CardTitle>
                  <CardDescription>Crear, editar y cambiar de proyecto.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={() => setSection('configuracion')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="size-4 text-primary" /> Configuración
                  </CardTitle>
                  <CardDescription>Tema, Supabase y datos locales.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Proyectos recientes */}
          <div>
            <h2 className="mb-3 text-sm font-semibold">Proyectos recientes</h2>
            <Card>
              <CardContent className="p-2">
                {(recentProjects ?? []).length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No hay proyectos.</p>
                ) : (
                  <ul>
                    {(recentProjects ?? []).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setActiveProjectId(p.id)}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate font-medium">{p.name}</span>
                          {p.id === activeProjectId && (
                            <span className="text-xs text-primary">Activo</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
