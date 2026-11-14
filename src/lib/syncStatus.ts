import { create } from 'zustand';

/**
 * Estado global de sincronización con Supabase.
 *
 * Contrato (Fase 1):
 * - 'local':   sin configuración de Supabase, todo funciona en local.
 * - 'syncing': comprobando / guardando la conexión.
 * - 'synced':  conectado a Supabase y funcionando.
 * - 'offline': había conexión pero el servidor no responde.
 * - 'pending': hay cambios locales pendientes de sincronizar (Fase 7).
 * - 'error':   la última comprobación de conexión falló.
 *
 * Se usa con useSyncStatus.getState().setStatus(...) desde src/lib/supabase.ts
 * y con el hook useSyncStatus() desde los componentes (barra superior, etc.).
 */

export type SyncState =
  | 'local'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'pending'
  | 'error';

const DEFAULT_MESSAGES: Record<SyncState, string> = {
  local: 'Modo local — Supabase sin configurar',
  syncing: 'Conectando con Supabase…',
  synced: 'Conectado a Supabase',
  offline: 'Sin conexión con Supabase',
  pending: 'Cambios pendientes de sincronizar',
  error: 'Error de conexión con Supabase',
};

interface SyncStatusState {
  status: SyncState;
  message: string;
  setStatus: (status: SyncState, message?: string) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'local',
  message: DEFAULT_MESSAGES.local,
  setStatus: (status, message) =>
    set({ status, message: message ?? DEFAULT_MESSAGES[status] }),
}));
