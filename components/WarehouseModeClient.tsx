'use client';

import { useState } from 'react';
import { ScanLine, Package, ArrowDown, ArrowUp, ClipboardCheck, ArrowLeftRight } from 'lucide-react';
import { ScannerInput } from './ScannerInput';

type Operation = 'reception' | 'expedition' | 'inventory' | 'transfer' | null;

export function WarehouseModeClient() {
  const [op, setOp] = useState<Operation>(null);
  const [history, setHistory] = useState<{ time: string; raw: string; gtin?: string; lot?: string }[]>([]);

  function handleScan(data: { raw: string; gtin?: string; lot?: string; serial?: string; expirationDate?: string }) {
    setHistory((h) => [
      { time: new Date().toLocaleTimeString('fr-FR'), raw: data.raw, gtin: data.gtin, lot: data.lot ?? data.serial },
      ...h,
    ].slice(0, 20));
  }

  if (!op) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setOp('reception')}
          className="card p-6 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition cursor-pointer text-left"
        >
          <ArrowDown className="size-8 text-emerald-600 mb-3" />
          <div className="font-semibold text-lg">Réception</div>
          <p className="text-sm text-zinc-500 mt-1">Scan produit, quantité, emplacement de destination</p>
        </button>
        <button
          onClick={() => setOp('expedition')}
          className="card p-6 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition cursor-pointer text-left"
        >
          <ArrowUp className="size-8 text-blue-600 mb-3" />
          <div className="font-semibold text-lg">Expédition</div>
          <p className="text-sm text-zinc-500 mt-1">Scan colis, validation envoi</p>
        </button>
        <button
          onClick={() => setOp('inventory')}
          className="card p-6 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition cursor-pointer text-left"
        >
          <ClipboardCheck className="size-8 text-amber-600 mb-3" />
          <div className="font-semibold text-lg">Inventaire</div>
          <p className="text-sm text-zinc-500 mt-1">Scan, comptage, validation</p>
        </button>
        <button
          onClick={() => setOp('transfer')}
          className="card p-6 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition cursor-pointer text-left"
        >
          <ArrowLeftRight className="size-8 text-violet-600 mb-3" />
          <div className="font-semibold text-lg">Transfert interne</div>
          <p className="text-sm text-zinc-500 mt-1">Scan source, produit, destination</p>
        </button>
      </div>
    );
  }

  const labels: Record<NonNullable<Operation>, string> = {
    reception: 'Réception en cours',
    expedition: 'Expédition en cours',
    inventory: 'Inventaire en cours',
    transfer: 'Transfert interne en cours',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ScanLine className="size-5" />
          {labels[op]}
        </h3>
        <button onClick={() => setOp(null)} className="btn-ghost">Quitter</button>
      </div>

      <div className="card p-5 mb-4">
        <ScannerInput onScan={handleScan} placeholder="Scannez ou saisissez un code-barres GS1…" />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package className="size-4 text-zinc-500" />
          <h4 className="font-semibold">Historique de scan ({history.length})</h4>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">Aucun scan pour le moment.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {history.map((h, i) => (
              <li key={i} className="py-2 flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-mono">{h.time}</span>
                <span className="font-mono text-sm break-all flex-1 truncate">{h.raw}</span>
                {h.gtin && <span className="badge bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">GTIN {h.gtin}</span>}
                {h.lot && <span className="badge bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs">Lot {h.lot}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
