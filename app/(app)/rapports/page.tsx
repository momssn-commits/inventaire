import Link from 'next/link';
import { BarChart3, FileText, TrendingUp, History, Truck, ClipboardCheck, Package, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { getStockByProduct } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await requireSession();
  const stockByProduct = await getStockByProduct();
  const totalValue = stockByProduct.reduce((s, p) => s + p.value, 0);

  // Vieillissement (par âge des stockLines)
  const stockLines = await prisma.stockLine.findMany({
    where: {
      product: { companyId: session.companyId },
      location: { type: 'internal' },
      quantity: { gt: 0 },
    },
    select: { quantity: true, unitCost: true, updatedAt: true },
  });
  const buckets = { '0-30': 0, '31-90': 0, '91-180': 0, '181-365': 0, '>365': 0 };
  const now = Date.now();
  for (const l of stockLines) {
    const days = (now - l.updatedAt.getTime()) / 86400000;
    const v = l.quantity * l.unitCost;
    if (days <= 30) buckets['0-30'] += v;
    else if (days <= 90) buckets['31-90'] += v;
    else if (days <= 180) buckets['91-180'] += v;
    else if (days <= 365) buckets['181-365'] += v;
    else buckets['>365'] += v;
  }

  // Performance fournisseurs
  const suppliers = await prisma.partner.findMany({
    where: { companyId: session.companyId, type: 'supplier', deletedAt: null },
    include: {
      poOrders: { include: { lines: true } },
      _count: { select: { poOrders: true } },
    },
  });
  const supplierPerf = suppliers
    .map((s) => {
      const orders = s.poOrders;
      const totalAmount = orders.reduce((sum, po) => sum + po.totalHt, 0);
      const received = orders.filter((po) => po.state === 'received' || po.state === 'invoiced').length;
      return { supplier: s, orderCount: orders.length, totalAmount, received };
    })
    .filter((p) => p.orderCount > 0);

  return (
    <div>
      <PageHeader
        title="Rapports & analyses"
        subtitle="État des stocks, valorisation, performance, traçabilité"
        module="M12"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="size-4 text-blue-600" />
            <div className="text-xs uppercase text-zinc-500 font-medium">Produits actifs</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{stockByProduct.length}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-emerald-600" />
            <div className="text-xs uppercase text-zinc-500 font-medium">Valeur stock</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{formatMoney(totalValue)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="size-4 text-violet-600" />
            <div className="text-xs uppercase text-zinc-500 font-medium">Bons en cours</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {await prisma.picking.count({
              where: { companyId: session.companyId, state: { in: ['draft', 'confirmed', 'assigned'] } },
            })}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <div className="text-xs uppercase text-zinc-500 font-medium">Alertes ouvertes</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {await prisma.qualityAlert.count({
              where: { companyId: session.companyId, state: { not: 'resolved' } },
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { href: '#stock', icon: Package, label: 'État des stocks', desc: 'Quantités par produit, emplacement, lot' },
          { href: '#movements', icon: History, label: 'Historique mouvements', desc: 'Trace exhaustive entrées/sorties' },
          { href: '#aging', icon: TrendingUp, label: 'Vieillissement stock', desc: 'Répartition par tranches d\'ancienneté' },
          { href: '/tracabilite', icon: FileText, label: 'Traçabilité', desc: 'Suivi ascendant/descendant lots & SN' },
        ].map((r, i) => (
          <Link key={i} href={r.href} className="card p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            <r.icon className="size-6 text-brand-600 mb-3" />
            <div className="font-semibold">{r.label}</div>
            <p className="text-xs text-zinc-500 mt-1">{r.desc}</p>
          </Link>
        ))}
      </div>

      <div id="stock" className="card overflow-x-auto mb-6">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Package className="size-4" /> État des stocks</h3>
          <span className="text-sm text-zinc-500">{stockByProduct.length} produits • Total {formatMoney(totalValue)}</span>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produit</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">Coût moyen</th>
              <th className="text-right">Valeur</th>
              <th className="text-right">% du total</th>
            </tr>
          </thead>
          <tbody>
            {stockByProduct.slice(0, 50).map((p) => (
              <tr key={p.product.id}>
                <td className="font-mono text-xs">{p.product.sku}</td>
                <td>
                  <Link href={`/produits/${p.product.id}`} className="text-brand-600 hover:underline">
                    {p.product.name}
                  </Link>
                </td>
                <td className="text-right tabular-nums">{formatNumber(p.qty, 0)}</td>
                <td className="text-right tabular-nums text-sm">
                  {formatMoney(p.qty > 0 ? p.value / p.qty : p.product.cost)}
                </td>
                <td className="text-right tabular-nums font-medium">{formatMoney(p.value)}</td>
                <td className="text-right tabular-nums text-sm text-zinc-500">
                  {totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(1) : '0'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="aging" className="card p-5 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="size-4" /> Vieillissement du stock</h3>
        <div className="space-y-3">
          {Object.entries(buckets).map(([bucket, value]) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            return (
              <div key={bucket}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{bucket} jours</span>
                  <span className="tabular-nums font-medium">{formatMoney(value)} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {supplierPerf.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="p-4">
            <h3 className="font-semibold flex items-center gap-2"><Truck className="size-4" /> Performance fournisseurs</h3>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th className="text-right">Commandes</th>
                <th className="text-right">Reçues</th>
                <th className="text-right">Taux</th>
                <th className="text-right">Montant total</th>
              </tr>
            </thead>
            <tbody>
              {supplierPerf.map((p) => (
                <tr key={p.supplier.id}>
                  <td>{p.supplier.name}</td>
                  <td className="text-right tabular-nums">{p.orderCount}</td>
                  <td className="text-right tabular-nums">{p.received}</td>
                  <td className="text-right tabular-nums">
                    {p.orderCount > 0 ? `${((p.received / p.orderCount) * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="text-right tabular-nums">{formatMoney(p.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
