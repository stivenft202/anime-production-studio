/**
 * Miniaturas perezosas para la galería de referencias (fase 4).
 *
 * `getAssetUrl` devuelve una data: URL en base64 para los archivos en
 * disco: cargar un vídeo o un audio completo como base64 congelaría la
 * interfaz, así que este hook SOLO se usa para imágenes pequeñas
 * (<= 5 MB) y SOLO cuando la tarjeta entra en el viewport
 * (IntersectionObserver). Vídeos, audios y documentos nunca pasan por
 * aquí: en la rejilla se muestran con icono + tipo, y su contenido
 * solo se carga cuando el usuario abre la vista previa.
 */
import { useEffect, useRef, useState } from 'react'
import { db, type Asset } from '../../db/db'
import { getAssetUrl, type AssetRef } from '../../lib/files'

/** Tamaño máximo de imagen para el que se genera miniatura (5 MB). */
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024

export function useLazyAssetUrl(asset: Asset | null | undefined): {
  url: string | null
  ref: (el: HTMLElement | null) => void
} {
  const [url, setUrl] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const elRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !asset) return
    let cancelled = false
    void (async () => {
      try {
        const record = await db.assets.get(asset.id)
        if (!record || cancelled) return
        const resolved = await getAssetUrl(record as unknown as AssetRef)
        if (!cancelled) setUrl(resolved ?? null)
      } catch {
        if (!cancelled) setUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, asset?.id])

  return {
    url,
    ref: (el: HTMLElement | null) => {
      elRef.current = el
    },
  }
}
