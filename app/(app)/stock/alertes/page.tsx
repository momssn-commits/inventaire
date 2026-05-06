import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, AlertOctagon, TrendingUp, Clock, Boxes,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatNumber, formatMoney, formatDate, relativeTime } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { getStockAlerts } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export default async function StockAlertsPage() {
  const session = await requireSession();
  const alerts = await getStockAlerts(session.companyId);

  // Calculer le stock disponible pour les listes (ruptures n'ont pas de stockLines positives)
  function totalQty(p: typeof alerts.ruptures[number]) {
    return p.stockLines.reduce((s, l) => s + l.quantity, 0);
  }

  const totalRuptureValue = alerts.ruptures.reduce((s, p) => s + p.cost * Math.max(p.maxQty - totalQty(p), 0), 0);

  return (
    <div>
      <PageHeader
        title="Alertes stock"
        subtitle="Ruptures, stocks sous le seuil, sur-stocks, vieillissement"
        module="Stock"
        actions={<Link href="/stock" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Ruptures"
          value={alerts.ruptures.length}
          icon={AlertOctagon}
          tone={alerts.ruptures.length > 0 ? 'danger' : 'success'}
          hint="Stock = 0"
        />
        <KpiCard
          label="Sous le seuil min."
          value={alerts.sousSeuil.length}
          icon={AlertTriangle}
          tone={alerts.sousSeuil.length > 0 ? 'warning' : 'success'}
          hint="0 < stock < min"
        />
        <KpiCard
          label="Sur-stocks"
          value={alerts.surStock.length}
          icon={TrendingUp}
          tone={alerts.surStock.length > 0 ? 'warning' : 'default'}
          hint="stock > 120% du max"
        />
        <KpiCard
          label="Vieillissement"
          value={alerts.oldStock.length}
          icon={Clock}
          tone={alerts.oldStock.length > 0 ? 'warning' : 'default'}
          hint="immobilisé > 1 an"
        />
      </div>

      {/* Ruptures */}
      <div className="card mb-4 overflow-x-auto">
        <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertOctagon className="size-4 text-red-600" /> Produits en rupture
            <span className="text-sm font-normal text-zinc-500">({alerts.ruptures.length})</span>
          </h3>
          {alerts.ruptures.length > 0 && (
            <Link href="/reassort" className="btn-primary text-sm">Lancer un réassort</Link>
          )}
        </div>
        {alerts.ruptures.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucune rupture" description="Tous les produits ont du stock disponible." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th className="text-right">Min.</th>
                <th className="text-right">Max.</th>
                <th className="text-right">À commander</th>
                <th className="text-right">Estimation HT</th>
                <th>Délai</th>
              </tr>
            </thead>
            <tbody>
              {alerts.ruptures.slice(0, 50).map((p) => {
                const need = Math.max(p.maxQty || p.reorderQty, p.reorderQty);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td>
                      <Link href={`/produits/${p.id}`} className="text-brand-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="text-right tabular-nums text-sm">{formatNumber(p.minQty, 0)}</td>
                    <td className="text-right tabular-nums text-sm">{formatNumber(p.maxQty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatNumber(need, 0)}</td>
                    <td className="text-right tabular-nums text-sm">{formatMoney(need * p.cost)}</td>
                    <td className="text-xs text-zinc-500">{p.leadTimeDays} j</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {alerts.ruptures.length > 50 && (
          <div className="p-3 text-xs text-zinc-500 text-center">
            {alerts.ruptures.length - 50} autres produits en rupture non affichés.
          </div>
        )}
      </div>

      {/* Sous-seuil */}
      <div className="card mb-4 overflow-x-auto">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" /> Stocks sous le seuil minimum
            <span className="text-sm font-normal text-zinc-500">({alerts.sousSeuil.length})</span>
          </h3>
        </div>
        {alerts.sousSeuil.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun stock sous le seuil" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th className="text-right">Disponible</th>
                <th className="text-right">Min.</th>
                <th className="text-right">Manque</th>
                <th>Délai</th>
              </tr>
            </thead>
            <tbody>
              {alerts.sousSeuil.slice(0, 50).map((p) => {
                const qty = totalQty(p);
                const manque = Math.max(p.minQty - qty, 0);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td>
                      <Link href={`/produits/${p.id}`} className="text-brand-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(qty, 0)}</td>
                    <td className="text-right tabular-nums text-zinc-500">{formatNumber(p.minQty, 0)}</td>
                    <td className="text-right tabular-nums font-medium text-amber-600">{formatNumber(manque, 0)}</td>
                    <td className="text-xs text-zinc-500">{p.leadTimeDays} j</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sur-stock */}
      <div className="card mb-4 overflow-x-auto">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-orange-600" /> Sur-stocks (&gt; 120% du max)
            <span className="text-sm font-normal text-zinc-500">({alerts.surStock.length})</span>
          </h3>
        </div>
        {alerts.surStock.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun sur-stock" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th className="text-right">Disponible</th>
                <th className="text-right">Max.</th>
                <th className="text-right">Excédent</th>
                <th className="text-right">Valeur immobilisée</th>
              </tr>
            </thead>
            <tbody>
              {alerts.surStock.slice(0, 50).map((p) => {
                const qty = totalQty(p);
                const excess = Math.max(qty - p.maxQty, 0);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td>
                      <Link href={`/produits/${p.id}`} className="text-brand-600 hover:underline">{p.name}</Link>
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(qty, 0)}</td>
                    <td className="text-right tabular-nums text-zinc-500">{formatNumber(p.maxQty, 0)}</td>
                    <td className="text-right tabular-nums font-medium text-orange-600">{formatNumber(excess, 0)}</td>
                    <td className="text-right tabular-nums">{formatMoney(excess * p.cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Vieillissement */}
      <div className="card mb-4 overflow-x-auto">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="size-4 text-zinc-500" /> Stock vieillissant (&gt; 1 an sans mouvement)
            <span className="text-sm font-normal text-zinc-500">({alerts.oldStock.length})</span>
          </h3>
        </div>
        {alerts.oldStock.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucun stock dormant" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Emplacement</th>
                <th>Lot / N° série</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Valeur</th>
                <th>Dernier mouvement</th>
              </tr>
            </thead>
            <tbody>
              {alerts.oldStock.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/produits/${s.product.id}`} className="text-brand-600 hover:underline">
                      {s.product.name}
                    </Link>
                  </td>
                  <td className="text-xs font-mono text-zinc-500">{s.location.fullPath}</td>
                  <td className="text-xs font-mono">{s.lot?.name ?? '—'}</td>
                  <td className="text-right tabular-nums">{formatNumber(s.quantity, 0)}</td>
                  <td className="text-right tabular-nums">{formatMoney(s.quantity * s.unitCost)}</td>
                  <td className="text-xs text-zinc-500">
                    {formatDate(s.updatedAt)} <span className="ml-1 italic">({relativeTime(s.updatedAt)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
