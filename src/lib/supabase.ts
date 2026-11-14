import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import { useSyncStatus } from './syncStatus';

/**
 * Cliente de Supabase para Anime Production Studio.
 *
 * Reglas de honestidad (Fase 1):
 * - NUNCA se inventan credenciales: sin configuración guardada no hay cliente.
 * - La service_role key NUNCA se guarda ni se usa en la app (solo URL + anon key).
 * - El estado de sincronización (useSyncStatus) refleja siempre la realidad:
 *   'local' sin config, 'synced' solo si el test real pasa, 'error' si falla.
 *
 * Dónde se guarda la configuración:
 * - Electron: window.electronAPI.storeGet/storeSet (safeStorage del main,
 *   archivo secure-store.json en userData). Los valores son strings, por
 *   eso la config se guarda como JSON.
 * - Web (vista previa): tabla settings de Dexie (src/db/db.ts, clave
 *   'supabase', valor JSON). Si IndexedDB no está disponible, se usa
 *   localStorage como último recurso ('aps:supabase-config').
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const ELECTRON_STORE_KEY = 'supabase';
const DEXIE_SETTINGS_KEY = 'supabase';
const WEB_STORAGE_KEY = 'aps:supabase-config';

// Variables de entorno opcionales (.env): solo se usan como valores
// iniciales si el usuario nunca guardó nada en Configuración.
const ENV_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const ENV_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

/**
 * window.electronAPI: su forma completa (ElectronAPIFull) está declarada
 * en src/vite-env.d.ts (ver electron/preload.ts). No se redeclara aquí
 * para no duplicar el tipo.
 */
function getElectronAPI(): ElectronAPIFull | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI;
}

function isElectron(): boolean {
  const api = getElectronAPI();
  return Boolean(api?.storeGet && api?.storeSet);
}

function parseConfig(raw: string | null | undefined): SupabaseConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (typeof parsed.url === 'string' && typeof parsed.anonKey === 'string') {
      return { url: parsed.url, anonKey: parsed.anonKey };
    }
    return null;
  } catch {
    return null;
  }
}

/** Adaptador web: tabla settings de Dexie, con localStorage como respaldo. */
const webSettingsStore = {
  async load(): Promise<SupabaseConfig | null> {
    try {
      const row = await db.settings.get(DEXIE_SETTINGS_KEY);
      const fromDexie = parseConfig(row?.value);
      if (fromDexie) return fromDexie;
    } catch {
      // IndexedDB no disponible: se sigue con localStorage.
    }
    try {
      const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
      const fromLs = parseConfig(raw);
      if (fromLs) {
        // Migrar la config antigua de localStorage a la tabla settings.
        await webSettingsStore.save(fromLs);
        window.localStorage.removeItem(WEB_STORAGE_KEY);
      }
      return fromLs;
    } catch {
      return null;
    }
  },
  async save(config: SupabaseConfig): Promise<boolean> {
    try {
      await db.settings.put({ key: DEXIE_SETTINGS_KEY, value: JSON.stringify(config) });
      return true;
    } catch {
      try {
        window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(config));
        return true;
      } catch {
        return false;
      }
    }
  },
  async clear(): Promise<void> {
    try {
      await db.settings.delete(DEXIE_SETTINGS_KEY);
    } catch {
      // Sin Dexie: basta con limpiar localStorage.
    }
    try {
      window.localStorage.removeItem(WEB_STORAGE_KEY);
    } catch {
      // Ignorar.
    }
  },
};

/**
 * Detecta si una clave parece ser la service_role key de Supabase.
 * Las claves de Supabase son JWT: se decodifica el payload y se comprueba
 * que el claim `role` sea 'service_role'. Ante cualquier duda no se bloquea
 * (una anon key normal tiene role 'anon').
 */
export function looksLikeServiceRoleKey(key: string): boolean {
  try {
    const parts = key.trim().split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: unknown };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function normalizeConfig(url: string, anonKey: string): SupabaseConfig {
  return { url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() };
}

/** Lee la configuración guardada (Electron, web o variables de entorno). */
export async function loadSupabaseConfig(): Promise<SupabaseConfig | null> {
  const api = getElectronAPI();
  if (api?.storeGet) {
    try {
      const saved = await api.storeGet(ELECTRON_STORE_KEY);
      const parsed = parseConfig(saved);
      if (parsed) return parsed;
    } catch {
      // Si falla el store de Electron, se sigue con el resto de fuentes.
    }
  }

  if (typeof window !== 'undefined') {
    const web = await webSettingsStore.load();
    if (web) return web;
  }

  if (ENV_URL && ENV_ANON_KEY) {
    return { url: ENV_URL, anonKey: ENV_ANON_KEY };
  }

  return null;
}

/**
 * Guarda la configuración (URL + anon key).
 * Rechaza la service_role key: nunca debe guardarse en la app.
 * Devuelve un mensaje de error en español si algo no es válido, o null si ok.
 */
export async function saveSupabaseConfig(
  url: string,
  anonKey: string,
): Promise<string | null> {
  const config = normalizeConfig(url, anonKey);

  if (!config.url || !config.anonKey) {
    return 'Faltan la URL del proyecto y la anon key.';
  }
  if (!/^https?:\/\/.+/.test(config.url)) {
    return 'La URL del proyecto no es válida. Debe empezar por https://';
  }
  if (looksLikeServiceRoleKey(config.anonKey)) {
    return 'Esa clave parece ser la service_role key. Por seguridad, la app solo acepta la anon key (pública); la service_role key nunca debe usarse en la aplicación.';
  }

  const api = getElectronAPI();
  if (api?.storeSet) {
    try {
      // storeSet cifra con safeStorage; el valor es el JSON de la config.
      await api.storeSet(ELECTRON_STORE_KEY, JSON.stringify(config));
    } catch (err) {
      return `No se pudo guardar la configuración: ${err instanceof Error ? err.message : 'error desconocido'}`;
    }
  } else if (typeof window !== 'undefined') {
    const saved = await webSettingsStore.save(config);
    if (!saved) {
      return 'No se pudo guardar la configuración en el navegador.';
    }
  }

  return null;
}

/** Borra la configuración guardada y vuelve al modo local. */
export async function clearSupabaseConfig(): Promise<void> {
  supabaseClient = null;
  const api = getElectronAPI();
  if (api?.storeSet) {
    try {
      // El preload no expone borrado: guardar cadena vacía = sin config.
      await api.storeSet(ELECTRON_STORE_KEY, '');
    } catch {
      // Si no se puede borrar del store, al menos se olvida el cliente.
    }
  } else if (typeof window !== 'undefined') {
    await webSettingsStore.clear();
  }
  useSyncStatus.getState().setStatus('local');
}

let supabaseClient: SupabaseClient | null = null;
let clientConfigKey = '';

/**
 * Devuelve el cliente de Supabase si hay configuración guardada, o null
 * si no la hay. Nunca devuelve un cliente con credenciales inventadas.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const config = await loadSupabaseConfig();
  if (!config) return null;

  const key = `${config.url}|${config.anonKey}`;
  if (supabaseClient && clientConfigKey === key) return supabaseClient;

  supabaseClient = createClient(config.url, config.anonKey);
  clientConfigKey = key;
  return supabaseClient;
}

/**
 * Prueba la conexión real con Supabase: hace una consulta ligera a la tabla
 * `projects`. Solo devuelve ok=true si el servidor responde correctamente.
 * Actualiza el estado global de sincronización según el resultado.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const setStatus = useSyncStatus.getState().setStatus;
  setStatus('syncing', 'Comprobando la conexión con Supabase…');

  const config = await loadSupabaseConfig();
  if (!config) {
    setStatus('local');
    return {
      ok: false,
      message: 'Supabase no está configurado. Todo funciona en modo local.',
    };
  }

  let client: SupabaseClient | null = null;
  try {
    client = await getSupabaseClient();
  } catch (err) {
    const message = 'No se pudo crear el cliente de Supabase. Revisa la URL y la anon key.';
    setStatus('error', message);
    return { ok: false, message: `${message} (${err instanceof Error ? err.message : 'error desconocido'})` };
  }
  if (!client) {
    setStatus('local');
    return { ok: false, message: 'Supabase no está configurado.' };
  }

  try {
    const { error } = await client
      .from('projects')
      .select('id', { head: true, count: 'exact' });

    if (error) {
      // El servidor respondió, pero algo no está bien: distinguir el motivo.
      const code = (error as { code?: string }).code ?? '';
      const msg = error.message ?? '';
      if (code === 'PGRST205' || /could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg)) {
        const message =
          'El servidor de Supabase responde, pero falta ejecutar la migración 0001_init.sql (la tabla projects no existe). Sigue la guía en docs/supabase-setup.md.';
        setStatus('error', message);
        return { ok: false, message };
      }
      if (code === 'PGRST301' || /JWT/i.test(msg) || /invalid api key/i.test(msg) || /unauthorized/i.test(msg)) {
        const message = 'La anon key no es válida o ha caducado. Cópiala de nuevo desde el panel de Supabase.';
        setStatus('error', message);
        return { ok: false, message };
      }
      const message = `Supabase respondió con un error: ${msg}`;
      setStatus('error', message);
      return { ok: false, message };
    }

    setStatus('synced', 'Conectado a Supabase');
    return { ok: true, message: 'Conexión correcta. Supabase está conectado.' };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const isNetwork =
      /fetch failed|network|Failed to fetch|ENOTFOUND|ECONNREFUSED|timeout/i.test(raw);
    const message = isNetwork
      ? 'No se pudo contactar con el servidor de Supabase. Revisa la URL del proyecto y tu conexión a internet.'
      : `Error al conectar con Supabase: ${raw}`;
    setStatus(isNetwork ? 'offline' : 'error', message);
    return { ok: false, message };
  }
}

/** Devuelve true si hay configuración guardada (sin probar la conexión). */
export async function hasSupabaseConfig(): Promise<boolean> {
  return (await loadSupabaseConfig()) !== null;
}

/** Al arrancar la app: refleja el estado real (local si no hay config). */
export async function initSyncStatus(): Promise<void> {
  const config = await loadSupabaseConfig();
  if (!config) {
    useSyncStatus.getState().setStatus('local');
  }
}
