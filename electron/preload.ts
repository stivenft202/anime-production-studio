import { contextBridge, ipcRenderer } from 'electron'

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

const electronAPI = {
  saveFile: (args: { name: string; buffer: ArrayBuffer; projectId: string }) =>
    ipcRenderer.invoke('files:save', args) as Promise<{ id: string; path: string }>,
  readFile: (args: { path: string }) =>
    ipcRenderer.invoke('files:read', args) as Promise<string>,
  deleteFile: (args: { path: string }) =>
    ipcRenderer.invoke('files:delete', args) as Promise<void>,
  userDataPath: () => ipcRenderer.invoke('files:userDataPath') as Promise<string>,
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key) as Promise<string | null>,
  storeSet: (key: string, value: string) => ipcRenderer.invoke('store:set', key, value) as Promise<void>,
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key) as Promise<void>,
  appVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  // --- Actualizador en la app (electron-updater, Fase 2.5) -----------------
  // La descarga es bajo demanda: checkForUpdates solo comprueba, nunca
  // descarga sola. Los eventos llegan por IPC desde el proceso main.
  updater: {
    checkForUpdates: () =>
      ipcRenderer.invoke('updater:check') as Promise<
        | { status: 'available' | 'not-available'; info: UpdateSummary | null }
        | { status: 'error'; info: null; message: string }
      >,
    downloadUpdate: () =>
      ipcRenderer.invoke('updater:download') as Promise<{ alreadyDownloaded: boolean }>,
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install') as Promise<void>,
    getDownloaded: () =>
      ipcRenderer.invoke('updater:downloaded') as Promise<UpdateSummary | null>,
    onUpdateAvailable: (cb: (info: UpdateSummary) => void) => {
      const handler = (_event: unknown, info: UpdateSummary) => cb(info)
      ipcRenderer.on('updater:available', handler)
      return () => {
        ipcRenderer.removeListener('updater:available', handler)
      }
    },
    onDownloadProgress: (cb: (progress: DownloadProgress) => void) => {
      const handler = (_event: unknown, progress: DownloadProgress) => cb(progress)
      ipcRenderer.on('updater:progress', handler)
      return () => {
        ipcRenderer.removeListener('updater:progress', handler)
      }
    },
    onUpdateDownloaded: (cb: (info: UpdateSummary) => void) => {
      const handler = (_event: unknown, info: UpdateSummary) => cb(info)
      ipcRenderer.on('updater:downloaded', handler)
      return () => {
        ipcRenderer.removeListener('updater:downloaded', handler)
      }
    },
    onUpdateNotAvailable: (cb: (info: UpdateSummary) => void) => {
      const handler = (_event: unknown, info: UpdateSummary) => cb(info)
      ipcRenderer.on('updater:not-available', handler)
      return () => {
        ipcRenderer.removeListener('updater:not-available', handler)
      }
    },
    onUpdaterError: (cb: (message: string) => void) => {
      const handler = (_event: unknown, message: string) => cb(message)
      ipcRenderer.on('updater:error', handler)
      return () => {
        ipcRenderer.removeListener('updater:error', handler)
      }
    },
  },
  store: {
    get: async (key: string): Promise<unknown> => {
      const raw = (await ipcRenderer.invoke('store:get', key)) as string | null
      if (raw === null) return null
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return raw
      }
    },
    set: async (key: string, value: unknown): Promise<void> => {
      const raw = typeof value === 'string' ? value : JSON.stringify(value)
      await ipcRenderer.invoke('store:set', key, raw)
    },
    delete: (key: string) => ipcRenderer.invoke('store:delete', key) as Promise<void>,
  },
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder') as Promise<void>,
  onMenuNewProject: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('menu:new-project', handler)
    return () => {
      ipcRenderer.removeListener('menu:new-project', handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
