import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Download, Moon, Search, Sun, User } from 'lucide-react'
import { db } from '../../db/db'
import { useAppStore } from '../../store/appStore'
import { useUpdaterStore } from '../../store/updaterStore'
import { SyncStatus } from '../SyncStatus'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { cn } from '../../lib/utils'

export function TopBar() {
  const { activeProjectId, setActiveProjectId, setSection, theme, setTheme } = useAppStore()
  const updaterInit = useUpdaterStore((s) => s.init)
  const updaterStatus = useUpdaterStore((s) => s.status)
  const updaterInfo = useUpdaterStore((s) => s.updateInfo)
  const requestGoToUpdates = useUpdaterStore((s) => s.requestGoToUpdates)
  const updateReady = updaterStatus === 'available' || updaterStatus === 'downloaded'

  useEffect(() => {
    updaterInit()
  }, [updaterInit])
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const characters = useLiveQuery(
    () => db.characters.where('projectId').equals(activeProjectId ?? '').sortBy('name'),
    [activeProjectId],
  )

  const results = (characters ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  // Cerrar los paneles al hacer clic fuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const activeProject = (projects ?? []).find((p) => p.id === activeProjectId)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      {/* Selector de proyecto */}
      <Select
        value={activeProjectId ?? ''}
        onValueChange={(v) => setActiveProjectId(v || null)}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Seleccionar proyecto">
            {activeProject ? activeProject.name : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(projects ?? []).map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          {(projects ?? []).length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Sin proyectos todavía</div>
          )}
        </SelectContent>
      </Select>

      {/* Búsqueda global de personajes */}
      <div ref={searchRef} className="relative hidden w-72 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Buscar personaje…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchOpen && query.trim() !== '' && (
          <div className="absolute left-0 right-0 top-10 z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                Sin resultados para «{query.trim()}»
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {results.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setSearchOpen(false)
                        setSection('personajes')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <User className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                      {c.role ? (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.role}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Aviso de actualización disponible (Fase 2.5): lleva a
            Configuración → Actualizaciones. */}
        {updateReady && (
          <button
            type="button"
            onClick={() => {
              setSection('configuracion')
              requestGoToUpdates()
            }}
            className="relative flex size-9 items-center justify-center rounded-md border border-input bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            title={
              updaterInfo
                ? `Hay una actualización disponible (v${updaterInfo.version}) — ver en Configuración`
                : 'Hay una actualización disponible — ver en Configuración'
            }
            aria-label="Hay una actualización disponible"
          >
            <Download className="size-4" />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-background" />
          </button>
        )}

        <SyncStatus />

        {/* Notificaciones */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className={cn(
              'flex size-9 items-center justify-center rounded-md border border-input bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
              notifOpen && 'bg-accent text-accent-foreground',
            )}
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <Bell className="size-4" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md">
              <h3 className="text-sm font-semibold">Notificaciones</h3>
              <p className="mt-2 text-sm text-muted-foreground">Sin notificaciones</p>
            </div>
          )}
        </div>

        {/* Tema */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex size-9 items-center justify-center rounded-md border border-input bg-background text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {/* Perfil */}
        <div className="flex items-center gap-2 rounded-md px-1 py-1">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            S
          </span>
          <span className="hidden text-sm font-medium lg:block">Stiven</span>
        </div>
      </div>
    </header>
  )
}
