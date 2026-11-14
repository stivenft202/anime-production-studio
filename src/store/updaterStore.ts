import { create } from 'zustand'

/**
 * Estado del actualizador en la app (Fase 2.5, electron-updater + GitHub).
 *
 * Fuente única de verdad para la sección "Actualizaciones" de Configuración
 * y para el aviso de la barra superior. En la vista previa web no hay
 * Electron (`window.electronAPI` es undefined): `available` queda en false
 * y la interfaz muestra que las actualizaciones solo funcionan en la app
 * de escritorio.
 *
 * Estados:
 *   idle           sin comprobar todavía (o vista previa web)
 *   checking       comprobando ahora mismo
 *   up-to-date     comprobado: estás en la última versión
 *   available      hay una versión nueva, sin descargar
 *   downloading    descargando (progress 0-100)
 *   downloaded     descargada y lista para instalar al salir
 *   error          no se pudo comprobar/descargar (error tiene el motivo)
 */

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateInfoLite {
  version: string
  releaseDate: string | null
  releaseNotes: string | null
}

interface UpdaterState {
  /** true solo en la app de escritorio (Electron). */
  available: boolean
  /** Versión instalada (en desarrollo es la versión de Electron). */
  currentVersion: string
  status: UpdaterStatus
  updateInfo: UpdateInfoLite | null
  progress: number
  error: string | null
  /** Contador: al cambiar, Configuración baja hasta la sección. */
  goToUpdatesSignal: number
  /** Suscribe los eventos del main (idempotente) y carga la versión. */
  init: () => void
  /** Comprobación manual (botón "Buscar actualizaciones"). */
  checkForUpdates: () => Promise<void>
  /** Descarga la actualización disponible. */
  downloadUpdate: () => Promise<void>
  /** Cierra la app e instala la actualización descargada. */
  quitAndInstall: () => Promise<void>
  /** Pide ir a Configuración → Actualizaciones. */
  requestGoToUpdates: () => void
}

let listenersReady = false

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  available: false,
  currentVersion: '',
  status: 'idle',
  updateInfo: null,
  progress: 0,
  error: null,
  goToUpdatesSignal: 0,

  init: () => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (!api?.updater) return
    set({ available: true })
    void api.appVersion().then(
      (v) => set({ currentVersion: v }),
      () => undefined,
    )
    // Si quedó una descarga lista de una sesión anterior del main (no es
    // el caso habitual: la descarga se pierde al cerrar), se refleja.
    void api.updater.getDownloaded().then((info) => {
      if (info) set({ status: 'downloaded', updateInfo: info, progress: 100 })
    })
    if (listenersReady) return
    listenersReady = true
    api.updater.onUpdateAvailable((info) => {
      set({ status: 'available', updateInfo: info, error: null, progress: 0 })
    })
    api.updater.onUpdateNotAvailable((info) => {
      // Solo cambia el estado si no hay una descarga en curso ni lista.
      const s = get().status
      if (s !== 'downloading' && s !== 'downloaded') {
        set({ status: 'up-to-date', updateInfo: info, error: null })
      }
    })
    api.updater.onDownloadProgress((p) => {
      set({ status: 'downloading', progress: p.percent })
    })
    api.updater.onUpdateDownloaded((info) => {
      set({ status: 'downloaded', updateInfo: info, progress: 100, error: null })
    })
    api.updater.onUpdaterError((message) => {
      // Un error durante la comprobación silenciosa del arranque no llega
      // aquí (el main lo filtra); si llega, es de una acción del usuario.
      set({ status: 'error', error: message })
    })
  },

  checkForUpdates: async () => {
    const api = window.electronAPI?.updater
    if (!api) return
    set({ status: 'checking', error: null })
    try {
      const result = await api.checkForUpdates()
      if (result.status === 'error') {
        set({ status: 'error', error: result.message })
      } else if (result.status === 'available') {
        set({ status: 'available', updateInfo: result.info, error: null, progress: 0 })
      } else {
        set({ status: 'up-to-date', updateInfo: result.info, error: null })
      }
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'No se pudo comprobar si hay actualizaciones.',
      })
    }
  },

  downloadUpdate: async () => {
    const api = window.electronAPI?.updater
    if (!api) return
    set({ status: 'downloading', progress: 0, error: null })
    try {
      const result = await api.downloadUpdate()
      if (result.alreadyDownloaded) {
        const info = await api.getDownloaded()
        if (info) set({ status: 'downloaded', updateInfo: info, progress: 100 })
      }
      // Si no, el evento 'update-downloaded' del main pone 'downloaded'.
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'No se pudo descargar la actualización.',
      })
    }
  },

  quitAndInstall: async () => {
    const api = window.electronAPI?.updater
    if (!api) return
    await api.quitAndInstall()
  },

  requestGoToUpdates: () => set((s) => ({ goToUpdatesSignal: s.goToUpdatesSignal + 1 })),
}))
