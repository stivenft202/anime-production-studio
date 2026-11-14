import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  FolderOpen,
  Info,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  XCircle,
} from 'lucide-react';
import {
  clearSupabaseConfig,
  loadSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';
import { useSyncStatus } from '../lib/syncStatus';
import { useAppStore, type Theme } from '../store/appStore';
import { useUpdaterStore } from '../store/updaterStore';

/**
 * Página de Configuración (Fase 1).
 *
 * Secciones reales y funcionales:
 *  (a) Apariencia: tema claro / oscuro, conectado al store global
 *      (src/store/appStore.ts: aplica la clase `dark` y persiste).
 *  (b) Supabase: URL + anon key, guardar, probar conexión (test real),
 *      desconectar. Sin configurar, todo funciona en local.
 *  (c) Datos locales: ruta de datos y botón para abrir la carpeta (solo
 *      en Electron, y solo si el proceso main expone `openDataFolder`).
 *  (d) Actualizaciones: versión instalada, buscar actualizaciones en
 *      GitHub, descargar e instalar al salir (solo en Electron; en la
 *      vista previa web muestra que no está disponible).
 *  (e) Acerca de: nombre, versión y descripción.
 */

function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.electronAPI?.storeGet === 'function'
  );
}

export default function Settings() {
  const syncStatus = useSyncStatus((s) => s.status);
  const syncMessage = useSyncStatus((s) => s.message);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [hasConfig, setHasConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string>('IndexedDB del navegador');
  const [canOpenDataFolder, setCanOpenDataFolder] = useState(false);

  // Actualizador en la app (Fase 2.5): solo existe en Electron.
  const updaterAvailable = useUpdaterStore((s) => s.available);
  const updaterInit = useUpdaterStore((s) => s.init);
  const updaterStatus = useUpdaterStore((s) => s.status);
  const updaterInfo = useUpdaterStore((s) => s.updateInfo);
  const updaterProgress = useUpdaterStore((s) => s.progress);
  const updaterError = useUpdaterStore((s) => s.error);
  const updaterVersion = useUpdaterStore((s) => s.currentVersion);
  const goToUpdatesSignal = useUpdaterStore((s) => s.goToUpdatesSignal);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const downloadUpdate = useUpdaterStore((s) => s.downloadUpdate);
  const quitAndInstall = useUpdaterStore((s) => s.quitAndInstall);
  const [installError, setInstallError] = useState<string | null>(null);
  const updatesSectionRef = useRef<HTMLElement | null>(null);

  // Al pulsar el aviso de la barra superior, bajar hasta Actualizaciones.
  useEffect(() => {
    if (goToUpdatesSignal === 0) return;
    updatesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [goToUpdatesSignal]);

  useEffect(() => {
    updaterInit();
  }, [updaterInit]);

  const handleQuitAndInstall = async () => {
    setInstallError(null);
    try {
      await quitAndInstall();
    } catch (e) {
      setInstallError(
        e instanceof Error ? e.message : 'No se pudo instalar la actualización.',
      );
    }
  };

  // Cargar la configuración guardada y la ruta de datos al entrar.
  useEffect(() => {
    let alive = true;
    void loadSupabaseConfig().then((config) => {
      if (!alive) return;
      if (config) {
        setSupabaseUrl(config.url);
        setAnonKey(config.anonKey);
        setHasConfig(true);
      }
    });
    const api = window.electronAPI;
    if (typeof api?.userDataPath === 'function') {
      void api.userDataPath().then((p) => {
        if (alive && typeof p === 'string' && p) setDataPath(p);
      });
    }
    setCanOpenDataFolder(typeof api?.openDataFolder === 'function');
    return () => {
      alive = false;
    };
  }, []);

  const changeTheme = (next: Theme) => {
    setTheme(next);
  };

  const handleSave = async () => {
    setFormError(null);
    setTestResult(null);
    setSaving(true);
    try {
      const error = await saveSupabaseConfig(supabaseUrl, anonKey);
      if (error) {
        setFormError(error);
        return;
      }
      setHasConfig(true);
      const result = await testSupabaseConnection();
      setTestResult(result);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setFormError(null);
    setTesting(true);
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    await clearSupabaseConfig();
    setSupabaseUrl('');
    setAnonKey('');
    setHasConfig(false);
    setTestResult(null);
    setFormError(null);
  };

  const handleOpenDataFolder = async () => {
    try {
      await window.electronAPI?.openDataFolder?.();
    } catch {
      // El main no pudo abrir la carpeta; no se muestra error invasivo.
    }
  };

  const connected = syncStatus === 'synced' && testResult?.ok !== false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajustes de la aplicación, conexión con Supabase y datos locales.
        </p>
      </header>

      {/* (a) Apariencia */}
      <section className="rounded-lg border p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          Apariencia
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige el tema de la aplicación. El modo oscuro es el predeterminado.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => changeTheme('light')}
            aria-pressed={theme === 'light'}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium ${
              theme === 'light' ? 'border-primary bg-primary/10' : 'hover:bg-accent'
            }`}
          >
            <Sun className="h-4 w-4" /> Claro
          </button>
          <button
            type="button"
            onClick={() => changeTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium ${
              theme === 'dark' ? 'border-primary bg-primary/10' : 'hover:bg-accent'
            }`}
          >
            <Moon className="h-4 w-4" /> Oscuro
          </button>
        </div>
      </section>

      {/* (b) Supabase */}
      <section className="rounded-lg border p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cloud className="h-5 w-5" />
          Supabase (nube, opcional)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta un proyecto de Supabase para sincronizar tus datos en la nube
          (fases futuras). Sin configurar, <strong>todo funciona en local</strong>:
          tus proyectos, personajes y guiones se guardan en tu equipo.
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm">
          {connected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">
                Conectado a Supabase
              </span>
            </>
          ) : (
            <>
              <CloudOff className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Sin configurar — modo local</span>
            </>
          )}
          <span className="text-muted-foreground">· {syncMessage}</span>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">URL del proyecto</span>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              autoComplete="off"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Anon key (clave pública)</span>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              autoComplete="off"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Solo se usa la <strong>anon key</strong> (pública). La{' '}
            <strong>service_role key nunca debe pegarse aquí</strong>: la app la
            rechaza por seguridad. La URL y la anon key están en el panel de
            Supabase → Settings → API. Guía paso a paso:{' '}
            <code>docs/supabase-setup.md</code>.
          </p>
        </div>

        {formError && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </p>
        )}

        {testResult && (
          <p
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              testResult.ok
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {testResult.message}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || testing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || saving || !hasConfig}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {testing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Probando…
              </span>
            ) : (
              'Probar conexión'
            )}
          </button>
          {hasConfig && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={saving || testing}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Desconectar
            </button>
          )}
        </div>
      </section>

      {/* (c) Datos locales */}
      <section className="rounded-lg border p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Database className="h-5 w-5" />
          Datos locales
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus proyectos se guardan en tu equipo, no en la carpeta de
          instalación, para que sobrevivan a actualizaciones y reinstalaciones.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium">Ruta de datos:</dt>
            <dd className="break-all font-mono text-xs">{dataPath}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Entorno:</dt>
            <dd>{isElectron() ? 'Aplicación de escritorio (Electron)' : 'Vista previa web'}</dd>
          </div>
        </dl>
        {canOpenDataFolder && (
          <button
            type="button"
            onClick={handleOpenDataFolder}
            className="mt-4 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <FolderOpen className="h-4 w-4" /> Abrir carpeta de datos
          </button>
        )}
      </section>

      {/* (d) Actualizaciones */}
      <section
        ref={updatesSectionRef}
        id="actualizaciones"
        className="rounded-lg border p-5"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Download className="h-5 w-5" />
          Actualizaciones
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Las actualizaciones llegan desde GitHub, sin tener que descargar el
          instalador a mano. Tus datos se guardan fuera de la carpeta de
          instalación, así que sobreviven a cada actualización.
        </p>

        {!updaterAvailable ? (
          <p className="mt-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Las actualizaciones dentro de la app solo están disponibles en la
            aplicación de escritorio. Estás viendo la vista previa web.
          </p>
        ) : (
          <>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Versión instalada:</dt>
                <dd className="font-mono text-xs">
                  {updaterVersion ? `v${updaterVersion}` : '…'}
                </dd>
              </div>
            </dl>

            {/* Estado de la comprobación */}
            {updaterStatus === 'checking' && (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando actualizaciones…
              </p>
            )}

            {updaterStatus === 'up-to-date' && (
              <p className="mt-4 flex items-start gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Estás al día: tienes la última versión
                {updaterInfo ? ` (v${updaterInfo.version})` : ''}.
              </p>
            )}

            {updaterStatus === 'idle' && (
              <p className="mt-4 text-sm text-muted-foreground">
                Todavía no se ha comprobado si hay una versión nueva.
              </p>
            )}

            {updaterStatus === 'available' && updaterInfo && (
              <div className="mt-4 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <p className="flex items-start gap-2 font-medium">
                  <Download className="mt-0.5 h-4 w-4 shrink-0" />
                  Hay una versión nueva: v{updaterInfo.version}
                  {formatReleaseDate(updaterInfo.releaseDate)
                    ? ` (${formatReleaseDate(updaterInfo.releaseDate)})`
                    : ''}
                </p>
                {updaterInfo.releaseNotes && (
                  <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-white/70 p-3 text-xs leading-relaxed">
                    {updaterInfo.releaseNotes}
                  </div>
                )}
              </div>
            )}

            {updaterStatus === 'downloading' && (
              <div className="mt-4">
                <p className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Descargando actualización… {updaterProgress}%
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={updaterProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${updaterProgress}%` }}
                  />
                </div>
              </div>
            )}

            {updaterStatus === 'downloaded' && updaterInfo && (
              <p className="mt-4 flex items-start gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                La versión v{updaterInfo.version} está descargada y lista para
                instalar. Al instalar, la app se cerrará y se abrirá de nuevo
                actualizada; tus proyectos y datos no se tocan.
              </p>
            )}

            {(updaterStatus === 'error' || installError) && (
              <p className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {installError ?? updaterError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void checkForUpdates()}
                disabled={updaterStatus === 'checking' || updaterStatus === 'downloading'}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {updaterStatus === 'checking' ? 'Buscando…' : 'Buscar actualizaciones'}
              </button>
              {updaterStatus === 'available' && (
                <button
                  type="button"
                  onClick={() => void downloadUpdate()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  Descargar actualización
                </button>
              )}
              {updaterStatus === 'downloaded' && (
                <button
                  type="button"
                  onClick={() => void handleQuitAndInstall()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Download className="h-4 w-4" />
                  Instalar al salir
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* (e) Acerca de */}
      <section className="rounded-lg border p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Info className="h-5 w-5" />
          Acerca de
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium">Nombre:</dt>
            <dd>Anime Production Studio</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Versión:</dt>
            <dd className="font-mono text-xs">
              {updaterAvailable
                ? updaterVersion
                  ? `v${updaterVersion}`
                  : '…'
                : 'Vista previa web'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Descripción:</dt>
            <dd>
              Aplicación de escritorio para gestionar proyectos de anime con IA:
              personajes, lore, guiones, episodios, voces y publicación, con
              almacenamiento local primero y sincronización opcional con
              Supabase.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
