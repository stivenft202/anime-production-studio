import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { db } from './db/db'
import { seedIfEmpty } from './lib/seed'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { Home } from './pages/Home'
import { Projects } from './pages/Projects'
import { Characters } from './pages/Characters'
import { Lore } from './pages/Lore'
import { Prompts } from './pages/Prompts'
import { References } from './pages/References'
import { Scripts } from './pages/Scripts'
import SettingsPage from './pages/Settings'
import { Placeholder } from './pages/Placeholder'
import { SECTIONS } from './lib/sections'

export default function App() {
  const { section, activeProjectId, setActiveProjectId, setSection, requestNewProject } = useAppStore()

  // El menú "Archivo > Nuevo proyecto" abre el diálogo de crear proyecto.
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMenuNewProject) return
    return api.onMenuNewProject(() => {
      setSection('proyectos')
      requestNewProject()
    })
  }, [setSection, requestNewProject])

  // Siembra inicial y selección del proyecto activo: se respeta el
  // último proyecto elegido (guardado en localStorage); si ya no
  // existe, se toma el primero por fecha de creación con desempate
  // por nombre (los dos proyectos semilla comparten createdAt, así
  // que sin desempate la elección era aleatoria).
  useEffect(() => {
    let cancelled = false
    seedIfEmpty()
      .then(async () => {
        if (cancelled) return
        const stored = useAppStore.getState().activeProjectId
        if (stored) {
          const exists = await db.projects.get(stored)
          if (exists) return
        }
        const all = await db.projects.toArray()
        all.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name))
        const first = all[0]
        if (first && !cancelled) setActiveProjectId(first.id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [setActiveProjectId])

  const meta = SECTIONS.find((s) => s.id === section)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {section === 'inicio' && <Home />}
          {section === 'proyectos' && <Projects />}
          {section === 'personajes' && <Characters />}
          {section === 'lore' && <Lore />}
          {section === 'guiones' && <Scripts />}
          {section === 'prompts' && <Prompts />}
          {section === 'referencias' && <References />}
          {section === 'configuracion' && <SettingsPage />}
          {meta && meta.phase !== null && section !== 'prompts' && section !== 'referencias' && (
            <Placeholder
              title={meta.label}
              phase={meta.phase}
              description="Esta sección forma parte de una fase posterior del proyecto."
            />
          )}
          {!meta && <Home />}
        </main>
      </div>
    </div>
  )
}
