import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import { tables } from '../../lib/characters';
import { getAssetUrl } from '../../lib/files';
import type { AssetRef } from '../../lib/files';

/** Resuelve la URL visible de un asset por su id (null mientras carga o si no existe). */
export function useAssetUrl(assetId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const asset = await tables(db).assets.get(assetId);
      if (!asset) {
        if (!cancelled) setUrl(null);
        return;
      }
      const resolved = await getAssetUrl(asset as unknown as AssetRef);
      if (!cancelled) setUrl(resolved ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return url;
}

/** Resuelve las URLs de varios assets; devuelve un mapa assetId -> url. */
export function useAssetUrlMap(assetIds: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = assetIds.join('|');

  useEffect(() => {
    if (assetIds.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const out: Record<string, string> = {};
      for (const id of assetIds) {
        const asset = await tables(db).assets.get(id);
        if (!asset) continue;
        const resolved = await getAssetUrl(asset as unknown as AssetRef);
        if (resolved) out[id] = resolved;
      }
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
    // La dependencia real es la lista de ids serializada (`key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
