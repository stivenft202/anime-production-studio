import { useEffect, useState } from 'react'
import { ChevronsLeft, ChevronsRight, Clapperboard } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { SECTIONS } from '../../lib/sections'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'

export function Sidebar() {
  const { section, setSection } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)
  const [version, setVersion] = useState('0.1.0')

  useEffect(() => {
    const api = window.electronAPI
    if (api) {
      api.appVersion().then(setVersion).catch(() => undefined)
    }
  }, [])

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-card transition-all',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Marca */}
      <div
        className={cn(
          'flex border-b',
          collapsed
            ? 'flex-col items-center gap-2 px-0 py-3'
            : 'h-14 items-center gap-2 px-3',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Clapperboard className="size-4" />
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold leading-tight">
            Anime Production Studio
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            !collapsed && 'ml-auto',
          )}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {/* Secciones */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = section === s.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSection(s.id)}
                  title={collapsed ? s.label : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{s.label}</span>}
                  {!collapsed && s.phase !== null && (
                    <Badge variant="secondary" className="text-[10px]">
                      Fase {s.phase}
                    </Badge>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Pie: usuario y versión */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            S
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">Stiven</p>
              <p className="truncate text-xs text-muted-foreground">v{version}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
