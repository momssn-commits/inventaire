'use client';

import { useEffect, useState } from 'react';
import { Activity, Server, AlertTriangle, Loader2 } from 'lucide-react';
import { formatMoney, formatNumber } from '@/lib/format';

type Stats = {
  counters: {
    products: number;
    warehouses: number;
    partners: number;
    lots: number;
    pickingsOpen: number;
    pickingsDone: number;
    qualityOpen: number;
    mosOpen: number;
  };
  stock: { units: number; value: number };
};

/**
 * Widget client-side qui démontre la connexion front ↔ back :
 * récupère /api/v1/stats via fetch HTTP (donc passe par l'API REST réelle).
 */
export function ApiLiveWidget() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    fetch('/api/v1/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) {
          setError(j.error.message ?? 'Erreur inconnue');
        } else {
          setStats(j.data);
          setError(null);
        }
        setLatency(Math.round(performance.now() - start));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return (
    <div className="card p-5 border-l-4 border-l-brand-500">
      <div className="flex items-center gap-2 mb-3">
        <Server className="size-4 text-brand-600" />
        <h3 className="font-semibold">Connexion front ↔ API REST v1</h3>
        <span className="ml-auto flex items-center gap-2">
          {error ? (
            <>
              <AlertTriangle className="size-3 text-red-600" />
              <span className="text-xs text-red-600">erreur</span>
            </>
          ) : stats ? (
            <>
              <Activity className="size-3 text-emerald-600" />
              <span className="text-xs text-emerald-600">{latency} ms</span>
            </>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin text-zinc-500" />
              <span className="text-xs text-zinc-500">chargement…</span>
            </>
          )}
        </span>
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        Ce panneau est rempli côté client par un appel HTTP à <code className="font-mono">GET /api/v1/stats</code> —
        la même API qu'un client externe utiliserait.
      </p>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded p-3">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-zinc-500">Produits</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.products, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Lots / N° série</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.lots, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Entrepôts</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.warehouses, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Partenaires</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.partners, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Mouvements en cours</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.pickingsOpen, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Alertes qualité</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.counters.qualityOpen, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Stock (unités)</div>
            <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.stock.units, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Valeur stock</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(stats.stock.value)}</div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs">
        <button
          onClick={() => setRefreshTick((t) => t + 1)}
          className="btn-ghost text-xs px-2 py-1"
        >
          ↻ Actualiser
        </button>
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
          Documentation API ↗
        </a>
      </div>
    </div>
  );
}
