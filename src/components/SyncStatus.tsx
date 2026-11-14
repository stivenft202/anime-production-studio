import { Cloud, CloudOff, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useSyncStatus, type SyncState } from '../lib/syncStatus'
import { cn } from '../lib/utils'

const ICONS: Record<SyncState, typeof Cloud> = {
  local: CloudOff,
  syncing: Loader2,
  synced: CheckCircle2,
  offline: CloudOff,
  pending: Clock,
  error: XCircle,
}

const LABELS: Record<SyncState, string> = {
  local: 'Local',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  offline: 'Sin conexión',
  pending: 'Pendiente',
  error: 'Error',
}

export function SyncStatus() {
  const { status, message } = useSyncStatus()
  const Icon = ICONS[status]
  return (
    <span
      title={message}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        status === 'synced' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        status === 'syncing' && 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
        status === 'pending' && 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        status === 'error' && 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
        (status === 'local' || status === 'offline') &&
          'border-border bg-muted text-muted-foreground',
      )}
    >
      <Icon className={cn('size-3.5', status === 'syncing' && 'animate-spin')} />
      {LABELS[status]}
    </span>
  )
}
