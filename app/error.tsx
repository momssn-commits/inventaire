'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw, LogOut } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Trace côté client — apparaît dans la console du navigateur
    console.error('[Inventaire] Erreur applicative :', error);
  }, [error]);

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
              <p className="text-sm text-zinc-500">L'application a rencontré un problème inattendu.</p>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 mb-4 border border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Message</div>
            <div className="font-mono text-sm break-words">
              {error.message || 'Erreur inconnue'}
            </div>
            {error.digest && (
              <>
                <div className="text-xs text-zinc-500 mt-3 mb-1">Identifiant (à communiquer au support)</div>
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

          <div className="flex gap-2">
            <button onClick={reset} className="btn-primary flex-1">
              <RotateCw className="size-4" /> Réessayer
            </button>
            <a href="/login" className="btn-secondary">
              <LogOut className="size-4" /> Se reconnecter
            </a>
          </div>

          <p className="text-xs text-zinc-500 mt-4 text-center">
            Si le problème persiste, déconnectez-vous puis videz le cache de votre navigateur (Cmd+Maj+R / Ctrl+Maj+R).
          </p>
        </div>
      </div>
    </div>
  );
}
