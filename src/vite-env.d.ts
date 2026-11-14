/// <reference types="vite/client" />

/**
 * Forma completa de `window.electronAPI` tal como la expone
 * electron/preload.ts. Declaración única: ningún otro archivo debe
 * redeclarar `ElectronAPI` ni `Window.electronAPI` (antes vivía una
 * copia reducida en src/lib/supabase.ts y TypeScript emitía TS2717).
 */

/** Resumen de una versión que envía el proceso main (sin datos internos). */
interface UpdateSummary {
  version: string
  releaseDate: string | null
  releaseNotes: string | null
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

type UpdateCheckResult =
  | { status: 'available' | 'not-available'; info: UpdateSummary | null }
  | { status: 'error'; info: null; message: string }

interface ElectronAPIFull {
  saveFile: (args: { name: string; buffer: ArrayBuffer; projectId: string }) => Promise<{ id: string; path: string }>
  readFile: (args: { path: string }) => Promise<string>
  deleteFile: (args: { path: string }) => Promise<void>
  userDataPath: () => Promise<string>
  storeGet: (key: string) => Promise<string | null>
  storeSet: (key: string, value: string) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  appVersion: () => Promise<string>
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  openDataFolder: () => Promise<void>
  onMenuNewProject: (cb: () => void) => () => void
  /** Actualizador en la app (electron-updater, Fase 2.5). Solo en Electron. */
  updater: {
    /** Comprueba si hay una versión nueva (no descarga nada). */
    checkForUpdates: () => Promise<UpdateCheckResult>
    /** Descarga la actualización disponible (bajo demanda). */
    downloadUpdate: () => Promise<{ alreadyDownloaded: boolean }>
    /** Cierra la app e instala la actualización descargada. */
    quitAndInstall: () => Promise<void>
    /** Versión ya descargada y lista para instalar, o null. */
    getDownloaded: () => Promise<UpdateSummary | null>
    onUpdateAvailable: (cb: (info: UpdateSummary) => void) => () => void
    onDownloadProgress: (cb: (progress: DownloadProgress) => void) => () => void
    onUpdateDownloaded: (cb: (info: UpdateSummary) => void) => () => void
    onUpdateNotAvailable: (cb: (info: UpdateSummary) => void) => () => void
    onUpdaterError: (cb: (message: string) => void) => () => void
  }
}

interface Window {
  electronAPI?: ElectronAPIFull
}
