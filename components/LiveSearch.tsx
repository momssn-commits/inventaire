'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Package, Tag, MapPin } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';

type ScanMatch = {
  type: 'product' | 'lot' | 'location';
  data: any;
};

/**
 * Recherche en direct : à chaque frappe, appelle GET /api/v1/products?q=...
 * + scan automatique si la query ressemble à un code-barres.
 */
export function LiveSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ products: any[]; matches: ScanMatch[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const start = performance.now();
      try {
        const isBarcode = /^[A-Z0-9\-/().]+$/i.test(query.trim()) && query.trim().length >= 4;
        const [productsResult, scanResult] = await Promise.all([
          api.products.list({ q: query.trim(), per_page: 5 }),
          isBarcode ? api.scan(query.trim()).catch(() => null) : Promise.resolve(null),
        ]);
        setResults({
          products: productsResult.data,
          matches: scanResult?.data?.matches ?? [],
        });
        setLatency(Math.round(performance.now() - start));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Erreur réseau');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="card p-5 border-l-4 border-l-emerald-500">
      <div className="flex items-center gap-2 mb-3">
        <Search className="size-4 text-emerald-600" />
        <h3 className="font-semibold">Recherche en direct (front → API)</h3>
        {loading && <Loader2 className="size-3 animate-spin text-zinc-400 ml-1" />}
        {latency !== null && !loading && (
          <span className="text-xs text-zinc-500 tabular-nums ml-auto">{latency} ms</span>
        )}
      </div>

      <p className="text-xs text-zinc-500 mb-3">
        Tapez un nom de produit, un SKU ou un code-barres (ex: <code className="font-mono">5000437</code>,
        <code className="font-mono">CHAISE</code>). Chaque frappe interroge l'API REST.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tapez pour rechercher…"
          className="input pl-9"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="rounded bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {results && results.products.length === 0 && results.matches.length === 0 && !loading && (
        <p className="text-sm text-zinc-500 text-center py-3">Aucun résultat.</p>
      )}

      {results && results.matches.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
          <div className="text-xs text-emerald-800 dark:text-emerald-200 font-medium mb-2">
            🎯 Correspondance directe (scan)
          </div>
          {results.matches.slice(0, 3).map((m, i) => (
            <div key={i} className="text-sm">
              {m.type === 'lot' && (
                <Link href={`/tracabilite?q=${encodeURIComponent(m.data.name)}`} className="block hover:underline">
                  <Tag className="size-3 inline mr-1" />
                  <span className="font-mono">{m.data.name}</span> →{' '}
                  <span className="font-medium">{m.data.product?.name}</span>
                </Link>
              )}
              {m.type === 'product' && (
                <Link href={`/produits/${m.data.id}`} className="block hover:underline">
                  <Package className="size-3 inline mr-1" />
                  <span className="font-medium">{m.data.name}</span>{' '}
                  <span className="text-zinc-500 text-xs">{m.data.sku}</span>
                </Link>
              )}
              {m.type === 'location' && (
                <Link href="/emplacements" className="block hover:underline">
                  <MapPin className="size-3 inline mr-1" />
                  <span className="font-mono text-xs">{m.data.fullPath}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {results && results.products.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {results.products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/produits/${p.id}`}
                className="flex items-center justify-between gap-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded px-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-zinc-500 font-mono">{p.sku}</div>
                </div>
                <div className="text-xs text-zinc-500 capitalize shrink-0">{p.tracking}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
