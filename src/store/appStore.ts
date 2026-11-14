import { create } from 'zustand'

export type SectionId =
  | 'inicio'
  | 'proyectos'
  | 'personajes'
  | 'lore'
  | 'guiones'
  | 'prompts'
  | 'referencias'
  | 'lugares'
  | 'voces'
  | 'publicacion'
  | 'equipo'
  | 'configuracion'

export type Theme = 'dark' | 'light'

interface AppState {
  theme: Theme
  activeProjectId: string | null
  section: SectionId
  /** Contador de peticiones de "Nuevo proyecto" (menú Archivo); al cambiar, Proyectos abre el diálogo de crear. */
  newProjectSignal: number
  setTheme: (t: Theme) => void
  setActiveProjectId: (id: string | null) => void
  setSection: (s: SectionId) => void
  requestNewProject: () => void
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('aps-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Sin acceso a localStorage: modo oscuro por defecto.
  }
  return 'dark'
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

function readStoredActiveProjectId(): string | null {
  try {
    return localStorage.getItem('aps-active-project')
  } catch {
    // Sin acceso a localStorage: sin proyecto guardado.
  }
  return null
}

const initialTheme = readStoredTheme()
applyTheme(initialTheme)

export const useAppStore = create<AppState>((set) => ({
  theme: initialTheme,
  activeProjectId: readStoredActiveProjectId(),
  section: 'inicio',
  newProjectSignal: 0,
  requestNewProject: () => set((s) => ({ newProjectSignal: s.newProjectSignal + 1 })),
  setTheme: (theme) => {
    applyTheme(theme)
    try {
      localStorage.setItem('aps-theme', theme)
    } catch {
      // Ignorar si no se puede persistir.
    }
    set({ theme })
  },
  setActiveProjectId: (activeProjectId) => {
    try {
      if (activeProjectId) localStorage.setItem('aps-active-project', activeProjectId)
      else localStorage.removeItem('aps-active-project')
    } catch {
      // Ignorar si no se puede persistir.
    }
    set({ activeProjectId })
  },
  setSection: (section) => set({ section }),
}))
