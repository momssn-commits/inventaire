'use client';

import { useEffect, useState } from 'react';
import { Activity, Copy, Check, ExternalLink, Server } from 'lucide-react';

type Health = { status: string; version: string; time: string; database: string };

export function ApiSection() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => r.json())
      .then((j) => setHealth(j.data))
      .catch((e) => setHealthError(e.message));
  }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-lg bg-brand-100 dark:bg-brand-950/40 grid place-items-center">
          <Server className="size-5 text-brand-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">API REST v1</h3>
          <p className="text-xs text-zinc-500">
            Exposée à <code className="font-mono">/api/v1/*</code> — JWT Bearer ou cookie de session
          </p>
        </div>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
        >
          <ExternalLink className="size-4" /> Documentation Swagger
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <div className="text-xs text-zinc-500 flex items-center gap-1 mb-1">
            <Activity className="size-3" /> Statut API
          </div>
          {health ? (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium">Opérationnelle</span>
              <span className="text-xs text-zinc-500 ml-auto">v{health.version}</span>
            </div>
          ) : healthError ? (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-600">{healthError}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-zinc-300 animate-pulse" />
              <span className="text-sm text-zinc-500">Vérification…</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <div className="text-xs text-zinc-500 mb-1">Base de données</div>
          <div className="text-sm font-medium">
            {health?.database === 'connected' ? '✅ Connectée' : '—'}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <div className="text-xs text-zinc-500 mb-1">Spécification</div>
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:underline font-mono"
          >
            OpenAPI 3.0.3 ↗
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
            Exemple : obtenir un jeton JWT
          </summary>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded overflow-x-auto">
{`curl -X POST ${baseUrl}/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@inventaire.fr","password":"admin123"}'`}
            </pre>
            <button
              onClick={() => copy(`curl -X POST ${baseUrl}/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@inventaire.fr","password":"admin123"}'`)}
              className="btn-ghost text-xs mt-2"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copier
            </button>
          </div>
        </details>

        <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
            Exemple : lister les produits
          </summary>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded overflow-x-auto">
{`curl ${baseUrl}/api/v1/products?per_page=10 \\
  -H "Authorization: Bearer <VOTRE_JWT>"`}
            </pre>
          </div>
        </details>

        <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
            Exemple : scanner un code-barres GS1
          </summary>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded overflow-x-auto">
{`curl -X POST ${baseUrl}/api/v1/scan \\
  -H "Authorization: Bearer <VOTRE_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"(01)03012345678901(10)L-2026-A(17)271231"}'`}
            </pre>
          </div>
        </details>

        <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="px-3 py-2 cursor-pointer text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
            Exemple : retrouver un actif par numéro de série (traçabilité)
          </summary>
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
            <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded overflow-x-auto">
{`curl ${baseUrl}/api/v1/lots/5000437 \\
  -H "Authorization: Bearer <VOTRE_JWT>"`}
            </pre>
          </div>
        </details>
      </div>

      <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded text-xs text-zinc-600 dark:text-zinc-400">
        <strong className="text-zinc-700 dark:text-zinc-300">Points clés :</strong>
        <ul className="mt-1 space-y-0.5 list-disc pl-5">
          <li>Versionnement explicite <code className="font-mono">/api/v1/</code></li>
          <li>Authentification JWT (Bearer) ou cookie de session</li>
          <li>Pagination, tri, filtrage standardisés sur toutes les listes</li>
          <li>Format de réponse uniforme : <code className="font-mono">{"{ data, meta? }"}</code> ou <code className="font-mono">{"{ error }"}</code></li>
          <li>Validation des entrées et codes HTTP RFC 7231 conformes</li>
        </ul>
      </div>
    </div>
  );
}
