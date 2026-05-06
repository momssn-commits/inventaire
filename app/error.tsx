'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCw, LogOut, Trash2 } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    console.error('[Inventaire] Erreur applicative :', error);
  }, [error]);

  /** Indique une erreur typique de bundle/Server Action obsolète. */
  const isStaleBundle =
    /unexpected response|Failed to fetch|Loading chunk|ChunkLoadError|action_id/i.test(
      error.message ?? ''
    );

  async function clearAllAndReload() {
    setCleaning(true);
    try {
      // 1. Désinscrire tous les Service Workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // 2. Vider tous les caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // 3. Nettoyer le storage local
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    } finally {
      // 4. Rechargement forcé (sans cache navigateur)
      window.location.replace('/login?cache_cleared=1');
    }
  }

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-lg w-full">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-lg bg-red-100 dark:bg-red-950/40 grid place-items-center">
              <AlertTriangle className="size-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
              <p className="text-sm text-zinc-500">
                {isStaleBundle
                  ? 'Le navigateur garde une ancienne version de l\'application en cache.'
                  : "L'application a rencontré un problème inattendu."}
              </p>
            </div>
          </div>

          {isStaleBundle && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 mb-4 border border-blue-200 dark:border-blue-900/40 text-sm text-blue-800 dark:text-blue-200">
              💡 Cliquez sur <strong>« Vider le cache et recharger »</strong> ci-dessous —
              cela résout le problème en quelques secondes.
            </div>
          )}

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 mb-4 border border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Message technique</div>
            <div className="font-mono text-sm break-words">
              {error.message || 'Erreur inconnue'}
            </div>
            {error.digest && (
              <>
                <div className="text-xs text-zinc-500 mt-3 mb-1">Identifiant</div>
                <code className="font-mono text-xs">{error.digest}</code>
              </>
            )}
            {isDev && error.stack && (
              <details className="mt-3">
                <summary className="text-xs text-zinc-500 cursor-pointer">Trace complète</summary>
                <pre className="text-[11px] mt-2 overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={clearAllAndReload}
              disabled={cleaning}
              className="btn-primary flex-1"
            >
              <Trash2 className="size-4" />
              {cleaning ? 'Nettoyage…' : 'Vider le cache et recharger'}
            </button>
            <button onClick={reset} className="btn-secondary">
              <RotateCw className="size-4" /> Réessayer
            </button>
            <a href="/api/auth/logout" className="btn-ghost">
              <LogOut className="size-4" /> Se reconnecter
            </a>
          </div>

          <p className="text-xs text-zinc-500 mt-4 text-center">
            Si le problème persiste après nettoyage, contactez l'administrateur en
            mentionnant l'identifiant ci-dessus.
          </p>
        </div>
      </div>
    </div>
  );
}
