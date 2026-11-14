import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell, type MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
// electron-updater expone `autoUpdater` con un getter perezoso
// (Object.defineProperty), que el cargador ESM de Node no detecta como
// exportación nombrada: `import { autoUpdater }` ROMPE en runtime con
// "Named export 'autoUpdater' not found". La importación por defecto sí
// funciona (module.exports completo). Los tipos se importan aparte.
import updaterPkg, { type ProgressInfo, type UpdateInfo } from 'electron-updater'

const { autoUpdater } = updaterPkg

// El main es un módulo ES: __dirname no existe, se calcula desde import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged

// Ventana principal, para que los ítems del menú puedan actuar sobre ella.
let mainWindow: BrowserWindow | null = null

function getTargetWindow(): BrowserWindow | null {
  return mainWindow ?? BrowserWindow.getFocusedWindow() ?? null
}

function showAbout(): void {
  const version = app.getVersion()
  app.setAboutPanelOptions({
    applicationName: 'Anime Production Studio',
    applicationVersion: version,
    version,
    copyright: '© Anime Production Studio',
    credits: 'Aplicación de escritorio para gestionar proyectos de anime con IA.',
  })
  if (process.platform === 'darwin') {
    app.showAboutPanel()
    return
  }
  // En Windows/Linux no hay panel "Acerca de" nativo: diálogo simple.
  const win = getTargetWindow()
  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'Acerca de Anime Production Studio',
    message: `Anime Production Studio\nVersión ${version}`,
    detail: 'Aplicación de escritorio para gestionar proyectos de anime con IA.\n\n© Anime Production Studio',
    buttons: ['Aceptar'],
    defaultId: 0,
  }
  if (win) {
    void dialog.showMessageBox(win, options)
  } else {
    void dialog.showMessageBox(options)
  }
}

// Menú de la aplicación en español (Electron pone por defecto uno en inglés).
function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    // En macOS el primer menú es el de la aplicación.
    ...(isMac
      ? [
          {
            label: 'Anime Production Studio',
            submenu: [
              { label: 'Acerca de Anime Production Studio', click: () => showAbout() },
              { type: 'separator' as const },
              { label: 'Salir de Anime Production Studio', role: 'quit' as const },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo proyecto',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // El renderer debe escuchar 'menu:new-project' para abrir el
            // formulario de nuevo proyecto.
            getTargetWindow()?.webContents.send('menu:new-project')
          },
        },
        {
          label: 'Abrir carpeta de datos',
          click: () => {
            void shell.openPath(app.getPath('userData'))
          },
        },
        { type: 'separator' },
        { label: 'Salir', role: 'quit', accelerator: 'Alt+F4' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: 'Rehacer', role: 'redo', accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: 'Copiar', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: 'Pegar', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: 'Seleccionar todo', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: 'Forzar recarga', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { label: 'Herramientas de desarrollo', role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen', accelerator: 'F11' },
        { label: 'Minimizar', role: 'minimize' },
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { label: 'Minimizar', role: 'minimize' },
        { label: 'Cerrar', role: 'close' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [{ label: 'Acerca de Anime Production Studio', click: () => showAbout() }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ============================================================================
// Actualizador en la app (Fase 2.5) — electron-updater + GitHub
// ----------------------------------------------------------------------------
// Flujo:
//   1. Al arrancar, comprobación SILENCIOSA (~5 s después de abrir la
//      ventana): si hay una versión nueva, el renderer se entera por el
//      evento 'updater:available' y muestra el aviso en la barra superior.
//      Si no hay nada o falla, NO se muestra nada (solo queda en el log).
//   2. Comprobación MANUAL desde Configuración → Actualizaciones
//      (ipc 'updater:check'): devuelve el resultado con el motivo en
//      español cuando no se puede comprobar.
//   3. Descarga BAJO DEMANDA (ipc 'updater:download', autoDownload =
//      false): el progreso llega al renderer por 'updater:progress'.
//   4. "Instalar al salir" (ipc 'updater:quit-and-install'): instalación
//      PROPIA (corrección v1.4.1): el main localiza el .exe descargado y
//      lo lanza él mismo con `/S --updated --force-run`, y solo entonces
//      cierra la app. NO se usa `autoUpdater.quitAndInstall`: en la
//      primera prueba real en Windows (v1.2.0 → v1.4.0, 2026-11-14) falló
//      sin que el usuario viera nada — pasaba isSilent=false pese al
//      comentario, el instalador NSIS personalizado ignoraba
//      `--updated --force-run`, y si el lanzamiento fallaba
//      electron-updater intentaba `elevate.exe`, que no existe en el
//      build (target `dir`); el error llegaba al renderer cuando la app
//      ya se estaba cerrando. El instalador NUNCA toca
//      %APPDATA%\Anime Production Studio: ahí viven los datos del
//      usuario y el desinstalador tampoco los borra (ver .nsi).
//      El .nsi usa `--updated --force-run` para reabrir la app ya
//      actualizada al terminar.
//   5. Sin autoInstallOnAppQuit: una actualización descargada solo se
//      instala cuando el usuario pulsa "Instalar al salir".
//   6. Registro: todo el flujo (comprobaciones, descargas, ruta del
//      instalador localizada, resultado del lanzamiento y errores) queda
//      en `userData/updater.log` (helper `logUpdater`), para que el
//      próximo fallo se pueda diagnosticar sin reproducirlo.
//
// Configuración:
//   - Instalada: resources/app-update.yml (copia de
//     electron/app-update.yml, incluida como extraResource en
//     electron-builder.yml; electron-builder NO la genera para el target
//     `dir`, solo para nsis/nsis-*).
//   - Desarrollo: dev-app-update.yml en la raíz del proyecto, activado
//     con forceDevUpdateConfig = true, para probar la comprobación sin
//     empaquetar. En desarrollo app.getVersion() devuelve la versión de
//     Electron (34.x), no la de package.json: es un comportamiento
//     conocido, no un error.
// El repo es público: la app descarga sin token. El repo solo guarda
// instaladores y latest.yml, nunca el código ni los datos del usuario.
// ============================================================================

/** Resumen de una versión que se envía al renderer (sin datos internos). */
interface UpdateSummary {
  version: string
  releaseDate: string | null
  releaseNotes: string | null
}

type CheckResult =
  | { status: 'available' | 'not-available'; info: UpdateSummary | null }
  | { status: 'error'; info: null; message: string }

// La última actualización descargada y lista para instalar (null si no hay).
let downloadedUpdate: UpdateInfo | null = null
// La última comprobación en curso: la silenciosa del arranque no debe
// mostrar errores en la interfaz (solo dejar constancia en el log).
let silentCheckRunning = false

function toSummary(info: UpdateInfo): UpdateSummary {
  // El proveedor de GitHub devuelve las notas como HTML (el markdown de la
  // release convertido). La interfaz las muestra como texto plano, así que
  // se convierten a texto legible; si no, el usuario vería las etiquetas.
  const stripHtmlNotes = (html: string): string =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  const notes = info.releaseNotes
  let releaseNotes: string | null = null
  if (typeof notes === 'string') {
    releaseNotes = stripHtmlNotes(notes)
  } else if (Array.isArray(notes)) {
    const parts = notes.map((n) => n.note).filter((n): n is string => typeof n === 'string' && n.length > 0)
    releaseNotes = parts.length > 0 ? stripHtmlNotes(parts.join('\n\n')) : null
  }
  return {
    version: info.version,
    releaseDate: info.releaseDate ?? null,
    releaseNotes,
  }
}

/** Traduce los errores de electron-updater/GitHub a mensajes claros. */
function friendlyUpdaterError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (/404|Not Found|no release|no published versions/i.test(raw)) {
    return 'Todavía no hay ninguna versión publicada en GitHub.'
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|network|fetch failed|getaddrinfo|offline|ERR_INTERNET_DISCONNECTED/i.test(raw)) {
    return 'No se pudo conectar con GitHub. Revisa tu conexión a internet e inténtalo de nuevo.'
  }
  if (/CERT_AUTHORITY_INVALID|CERT_COMMON_NAME_INVALID|CERT_DATE_INVALID|ERR_CERT/i.test(raw)) {
    return 'No se pudo establecer una conexión segura con GitHub. Puede que un antivirus, un proxy o el cortafuegos esté bloqueando la conexión.'
  }
  if (/ERR_UPDATER_INVALID_VERSION|invalid version/i.test(raw)) {
    return 'La versión instalada no se pudo comparar con la publicada.'
  }
  if (/ENOENT|dev-app-update\.yml|app-update\.yml/i.test(raw)) {
    return 'Falta el archivo de configuración del actualizador (app-update.yml).'
  }
  return `No se pudo comprobar si hay actualizaciones: ${raw}`
}

function sendToRenderer(channel: string, payload: unknown): void {
  getTargetWindow()?.webContents.send(channel, payload)
}

// ============================================================================
// Registro del actualizador (v1.4.1) + localización del instalador descargado
// ============================================================================

/** Nombre del instalador que publica cada release en GitHub. */
const INSTALLER_FILE_NAME = 'ANIME-PRODUCTION-STUDIO-SETUP.exe'

/**
 * Registro del actualizador en `userData/updater.log` (append, con
 * fecha/hora ISO). El registro nunca debe romper el actualizador: si no
 * se puede escribir, se ignora en silencio.
 */
async function logUpdater(message: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`
  try {
    await fs.appendFile(path.join(app.getPath('userData'), 'updater.log'), line, 'utf-8')
  } catch {
    // Sin registro no hay diagnóstico, pero tampoco debe fallar la app.
  }
}

/** Forma mínima del DownloadedUpdateHelper de electron-updater. */
interface DownloadedUpdateHelperLike {
  /** Ruta del .exe descargado (null si no hay descarga en esta sesión). */
  file: string | null
  /** Carpeta de caché del actualizador (<baseCache>/<updaterCacheDirName>). */
  cacheDir: string
}

/**
 * El helper es `protected` en AppUpdater (AppUpdater.d.ts), así que se
 * accede con un cast. Verificado en
 * node_modules/electron-updater/out/DownloadedUpdateHelper.js:
 * `get file()` devuelve `this._file`, la ruta del .exe descargado, y
 * `cacheDir` es la carpeta de caché; el .exe descargado vive en
 * `cacheDir/pending` (getter `cacheDirForPendingUpdate`).
 */
function getUpdaterDownloadHelper(): DownloadedUpdateHelperLike | null {
  const holder = autoUpdater as unknown as { downloadedUpdateHelper: DownloadedUpdateHelperLike | null }
  return holder.downloadedUpdateHelper ?? null
}

/**
 * Réplica de `getAppCacheDir()` de electron-updater (out/AppAdapter.js),
 * que es la base de la carpeta de caché del actualizador
 * (`AppUpdater.getOrCreateDownloadHelper`: cacheDir = baseCachePath +
 * updaterCacheDirName, y updaterCacheDirName es 'anime-production-studio'
 * en electron/app-update.yml). En Windows es %LOCALAPPDATA%.
 */
function getUpdaterBaseCacheDir(): string {
  const home = homedir()
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches')
  }
  return process.env.XDG_CACHE_HOME ?? path.join(home, '.cache')
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Localiza el instalador descargado, en orden:
 *   1. `downloadedUpdateHelper.file` (la descarga de esta sesión);
 *   2. `<cacheDir>/pending/<nombre>` con el cacheDir del helper, si existe;
 *   3. `<baseCache>/anime-production-studio/pending/<nombre>` (réplica de
 *       la ruta que calcula electron-updater, por si el helper aún no se
 *       creó en esta sesión).
 * Cada candidato se comprueba en disco; se registra cada intento. Devuelve
 * null si ninguno existe.
 */
async function findDownloadedInstaller(): Promise<string | null> {
  const helper = getUpdaterDownloadHelper()
  const candidates: string[] = []
  if (helper?.file) {
    candidates.push(helper.file)
  }
  const cacheDirs: string[] = []
  if (helper) {
    cacheDirs.push(helper.cacheDir)
  }
  cacheDirs.push(path.join(getUpdaterBaseCacheDir(), 'anime-production-studio'))
  for (const dir of cacheDirs) {
    candidates.push(path.join(dir, 'pending', INSTALLER_FILE_NAME))
  }
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      await logUpdater(`Instalador descargado localizado: ${candidate}`)
      return candidate
    }
    await logUpdater(`Instalador no encontrado en: ${candidate}`)
  }
  return null
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false
  // La instalación solo ocurre cuando el usuario pulsa "Instalar al salir".
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  if (isDev) {
    // En desarrollo electron-updater no comprueba nada salvo que se fuerce:
    // usa dev-app-update.yml (raíz del proyecto) en vez de app-update.yml.
    autoUpdater.forceDevUpdateConfig = true
  }

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    void logUpdater(`Comprobación: hay una versión nueva: v${info.version}`)
    sendToRenderer('updater:available', toSummary(info))
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    void logUpdater(`Comprobación: estás al día (última versión: v${info.version})`)
    if (!silentCheckRunning) {
      sendToRenderer('updater:not-available', toSummary(info))
    }
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendToRenderer('updater:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    downloadedUpdate = info
    const helperFile = getUpdaterDownloadHelper()?.file
    void logUpdater(
      `Descarga completada: v${info.version}` +
        (helperFile ? ` — instalador en: ${helperFile}` : ' — ruta del instalador no disponible en el helper'),
    )
    sendToRenderer('updater:downloaded', toSummary(info))
  })

  autoUpdater.on('error', (error: Error) => {
    void logUpdater(`Error del actualizador: ${error.message}`)
    // La comprobación silenciosa del arranque nunca muestra errores.
    if (silentCheckRunning) return
    sendToRenderer('updater:error', friendlyUpdaterError(error))
  })
}

/** Comprobación de actualizaciones. `silent` = la del arranque (sin UI). */
async function runUpdateCheck(silent: boolean): Promise<CheckResult> {
  silentCheckRunning = silent
  await logUpdater(`Comprobación de actualizaciones iniciada (${silent ? 'silenciosa, al arrancar' : 'manual'})`)
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result === null) {
      await logUpdater('Comprobación fallida: el actualizador no está disponible en este entorno')
      return { status: 'error', info: null, message: 'El actualizador no está disponible en este entorno.' }
    }
    await logUpdater(
      result.isUpdateAvailable
        ? `Comprobación: versión nueva disponible: v${result.updateInfo.version}`
        : `Comprobación: sin actualizaciones (última versión: v${result.updateInfo.version})`,
    )
    return result.isUpdateAvailable
      ? { status: 'available', info: toSummary(result.updateInfo) }
      : { status: 'not-available', info: toSummary(result.updateInfo) }
  } catch (error) {
    const message = friendlyUpdaterError(error)
    await logUpdater(`Comprobación fallida: ${message}`)
    return { status: 'error', info: null, message }
  } finally {
    silentCheckRunning = false
  }
}

async function ensureAssetsDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'assets')
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Anime Production Studio',
    webPreferences: {
      // El preload se compila como preload.mjs (el paquete es ESM:
      // "type": "module"). Antes apuntaba a preload.js, que no existe,
      // así que window.electronAPI nunca se exponía y la app caía en
      // silencio al modo web (blobs en IndexedDB en vez de disco).
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow = win
}

app.whenReady().then(async () => {
  await ensureAssetsDir()
  buildApplicationMenu()
  setupAutoUpdater()

  // --- Actualizador: IPC con el renderer (ver setupAutoUpdater) -----------
  ipcMain.handle('updater:check', async () => {
    return runUpdateCheck(false)
  })

  ipcMain.handle('updater:download', async () => {
    if (downloadedUpdate) return { alreadyDownloaded: true }
    await logUpdater('Descarga de actualización iniciada (manual)')
    try {
      await autoUpdater.downloadUpdate()
      await logUpdater('Descarga de actualización terminada')
      return { alreadyDownloaded: false }
    } catch (error) {
      const message = friendlyUpdaterError(error)
      await logUpdater(`Descarga fallida: ${message}`)
      throw new Error(message)
    }
  })

  ipcMain.handle('updater:quit-and-install', async () => {
    if (!downloadedUpdate) {
      const message = 'No hay ninguna actualización descargada lista para instalar.'
      await logUpdater(`Instalar al salir rechazado: ${message}`)
      throw new Error(message)
    }
    // Instalación PROPIA (v1.4.1): NO se usa autoUpdater.quitAndInstall
    // (ver el comentario del flujo en setupAutoUpdater): el main localiza
    // el .exe descargado y lo lanza él mismo en silencio (/S), con
    // --updated --force-run para que el instalador reabra la app ya
    // actualizada. Si el lanzamiento falla, el error llega al renderer
    // ANTES de cerrar nada: el usuario lo ve y la app sigue abierta.
    const installerPath = await findDownloadedInstaller()
    if (!installerPath) {
      const message =
        'No se encontró el instalador descargado (ANIME-PRODUCTION-STUDIO-SETUP.exe) en la carpeta de caché del actualizador. Vuelve a descargar la actualización e inténtalo de nuevo.'
      await logUpdater(`Instalar al salir fallido: ${message}`)
      throw new Error(message)
    }
    await logUpdater(
      `Lanzando instalador: ${installerPath} con /S --updated --force-run (versión descargada: v${downloadedUpdate.version})`,
    )
    const child = spawn(installerPath, ['/S', '--updated', '--force-run'], {
      detached: true,
      stdio: 'ignore',
    })
    const launched = await new Promise<boolean>((resolve) => {
      child.once('error', (error) => {
        void logUpdater(`Fallo al lanzar el instalador: ${error.message}`)
        resolve(false)
      })
      child.once('spawn', () => resolve(true))
    })
    if (!launched) {
      throw new Error(
        'No se pudo lanzar el instalador descargado. La app sigue abierta: vuelve a intentarlo o descarga la actualización de nuevo. El detalle quedó en el registro de actualizaciones (updater.log, en la carpeta de datos).',
      )
    }
    child.unref()
    await logUpdater('Instalador lanzado correctamente; cerrando la app para que el instalador tome el relevo')
    // Responder OK al renderer antes de cerrar, para que no vea un error.
    setTimeout(() => app.quit(), 500)
    return { ok: true }
  })

  ipcMain.handle('updater:downloaded', () => {
    return downloadedUpdate ? toSummary(downloadedUpdate) : null
  })

  ipcMain.handle('files:save', async (_event, args: { name: string; buffer: ArrayBuffer; projectId: string }) => {
    const id = randomUUID()
    const safeName = args.name.replace(/[\\/:"*?<>|]+/g, '_')
    const fileName = `${id}-${safeName}`
    const dir = await ensureAssetsDir()
    const filePath = path.join(dir, fileName)
    await fs.writeFile(filePath, Buffer.from(args.buffer))
    return { id, path: filePath }
  })

  ipcMain.handle('files:read', async (_event, args: { path: string }) => {
    const data = await fs.readFile(args.path)
    return data.toString('base64')
  })

  ipcMain.handle('files:delete', async (_event, args: { path: string }) => {
    await fs.unlink(args.path).catch(() => undefined)
  })

  ipcMain.handle('files:userDataPath', () => {
    return app.getPath('userData')
  })

  ipcMain.handle('store:get', async (_event, key: string) => {
    const file = path.join(app.getPath('userData'), 'secure-store.json')
    let store: Record<string, string> = {}
    try {
      const raw = await fs.readFile(file, 'utf-8')
      store = JSON.parse(raw) as Record<string, string>
    } catch {
      store = {}
    }
    const encrypted = store[key]
    if (!encrypted) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
      return null
    }
  })

  ipcMain.handle('store:set', async (_event, key: string, value: string | unknown) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('El cifrado seguro no está disponible en este equipo.')
    }
    const file = path.join(app.getPath('userData'), 'secure-store.json')
    let store: Record<string, string> = {}
    try {
      const raw = await fs.readFile(file, 'utf-8')
      store = JSON.parse(raw) as Record<string, string>
    } catch {
      store = {}
    }
    const rawValue = typeof value === 'string' ? value : JSON.stringify(value)
    store[key] = safeStorage.encryptString(rawValue).toString('base64')
    await fs.writeFile(file, JSON.stringify(store), 'utf-8')
  })

  ipcMain.handle('store:delete', async (_event, key: string) => {
    const file = path.join(app.getPath('userData'), 'secure-store.json')
    let store: Record<string, string> = {}
    try {
      const raw = await fs.readFile(file, 'utf-8')
      store = JSON.parse(raw) as Record<string, string>
    } catch {
      return
    }
    delete store[key]
    await fs.writeFile(file, JSON.stringify(store), 'utf-8')
  })

  ipcMain.handle('app:openDataFolder', async () => {
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  createWindow()

  // Comprobación silenciosa al arrancar: sin bloquear la ventana ni
  // mostrar nada si no hay actualización o si falla la comprobación.
  // Si HAY una versión nueva, el renderer recibe 'updater:available' y
  // muestra el aviso en la barra superior.
  setTimeout(() => {
    void runUpdateCheck(true).catch(() => undefined)
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
