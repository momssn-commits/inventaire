'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Server, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { formatMoney, formatNumber } from '@/lib/format';
import { api, ApiError } from '@/lib/api-client';

const REFRESH_MS = 30000;

/**
 * Widget client-side qui démontre la connexion front ↔ back :
 * appelle GET /api/v1/stats via fetch HTTP, refresh auto toutes les 30 s.
 */
export function ApiLiveWidget() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.stats>>['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setRefreshing(true);
    const start = performance.now();
    try {
      const result = await api.stats();
      setStats(result.data);
      setError(null);
      setLatency(Math.round(performance.now() - start));
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="card p-5 border-l-4 border-l-brand-500">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Server className="size-4 text-brand-600" />
        <h3 className="font-semibold">Connexion front ↔ API REST v1</h3>
        <span className="ml-auto flex items-center gap-2 flex-wrap">
          {error ? (
            <>
              <AlertTriangle className="size-3 text-red-600" />
              <span className="text-xs text-red-600">{error}</span>
            </>
          ) : stats ? (
            <>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-700 dark:text-emerald-400">en ligne</span>
              <span className="text-xs text-zinc-500 tabular-nums">{latency} ms</span>
              {lastUpdate && (
                <span className="text-xs text-zinc-400 tabular-nums">
                  · {lastUpdate.toLocaleTimeString('fr-FR')}
                </span>
              )}
            </>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin text-zinc-500" />
              <span className="text-xs text-zinc-500">chargement…</span>
            </>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="btn-ghost p-1"
            title="Rafraîchir maintenant"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </span>
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        Données rafraîchies automatiquement toutes les {REFRESH_MS / 1000}s via{' '}
        <code className="font-mono text-[11px]">GET /api/v1/stats</code> — la même
        API qu'un client externe utiliserait.
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

      <div className="mt-3 flex items-center gap-3 text-xs">
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
          Documentation API ↗
        </a>
        <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
          OpenAPI spec ↗
        </a>
      </div>
    </div>
  );
}
