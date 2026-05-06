'use client';

import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type Status = 'connecting' | 'online' | 'offline';

/**
 * Pastille temps-réel qui ping /api/v1/health toutes les 15 s pour
 * confirmer que le front est connecté au back.
 */
export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('connecting');
  const [latency, setLatency] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function ping() {
    const start = performance.now();
    try {
      await api.health();
      setLatency(Math.round(performance.now() - start));
      setStatus('online');
    } catch {
      setStatus('offline');
      setLatency(null);
    }
  }

  useEffect(() => {
    ping();
    intervalRef.current = setInterval(ping, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const dotClass = cn(
    'size-2 rounded-full',
    status === 'online' && 'bg-emerald-500',
    status === 'offline' && 'bg-red-500',
    status === 'connecting' && 'bg-zinc-400 animate-pulse'
  );

  const labels: Record<Status, string> = {
    connecting: 'Connexion…',
    online: 'API en ligne',
    offline: 'API hors ligne',
  };

  return (
    <button
      type="button"
      onClick={ping}
      title="Cliquer pour rafraîchir"
      className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
    >
      {status === 'offline' ? (
        <WifiOff className="size-3.5 text-red-600" />
      ) : (
        <Wifi className="size-3.5 text-zinc-500" />
      )}
      <span className={dotClass} />
      <span className="text-zinc-600 dark:text-zinc-300">{labels[status]}</span>
      {latency !== null && status === 'online' && (
        <span className="text-zinc-400 tabular-nums">{latency} ms</span>
      )}
    </button>
  );
}
