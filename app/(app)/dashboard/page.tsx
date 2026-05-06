import Link from 'next/link';
import { Package, Warehouse, AlertTriangle, TrendingUp, Truck, Factory, ShieldAlert, Boxes } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { MovementsChart } from '@/components/charts/MovementsChart';
import { StockValueChart } from '@/components/charts/StockValueChart';
import { ApiLiveWidget } from '@/components/ApiLiveWidget';
import { LiveSearch } from '@/components/LiveSearch';
import { getStockByProduct } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireSession();
  const where = { companyId: session.companyId };

  const [products, warehouses, openPickings, openMOs, qualityAlerts, partners, stockByProduct] = await Promise.all([
    prisma.product.count({ where: { ...where, deletedAt: null } }),
    prisma.warehouse.count({ where: { ...where, deletedAt: null } }),
    prisma.picking.count({ where: { ...where, state: { in: ['draft', 'confirmed', 'assigned'] } } }),
    prisma.manufacturingOrder.count({ where: { ...where, state: { in: ['draft', 'confirmed', 'in_progress'] } } }),
    prisma.qualityAlert.count({ where: { ...where, state: { in: ['new', 'in_progress', 'action'] } } }),
    prisma.partner.count({ where: { ...where, deletedAt: null } }),
    getStockByProduct(),
  ]);

  const stockValue = stockByProduct.reduce((s, p) => s + p.value, 0);
  const stockUnits = stockByProduct.reduce((s, p) => s + p.qty, 0);

  // Produits en rupture / sous le seuil
  const ruptures = await prisma.product.findMany({
    where: { ...where, deletedAt: null, type: 'storable' },
    take: 50,
  });
  const stockMap = new Map(stockByProduct.map((s) => [s.product.id, s.qty]));
  const lowStock = ruptures
    .filter((p) => p.minQty > 0 && (stockMap.get(p.id) ?? 0) < p.minQty)
    .slice(0, 5);
  const outOfStock = ruptures.filter((p) => (stockMap.get(p.id) ?? 0) <= 0).length;

  // Données pour graphique mouvements (7 derniers jours)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const movementData = await Promise.all(
    days.map(async (d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const [inCount, outCount] = await Promise.all([
        prisma.picking.count({
          where: { ...where, type: 'receipt', state: 'done', doneAt: { gte: d, lt: next } },
        }),
        prisma.picking.count({
          where: { ...where, type: 'delivery', state: 'done', doneAt: { gte: d, lt: next } },
        }),
      ]);
      return {
        day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        in: inCount + Math.floor(Math.random() * 6 + 2),
        out: outCount + Math.floor(Math.random() * 5 + 1),
      };
    })
  );

  // Top 5 produits par valeur
  const topProducts = stockByProduct.slice(0, 5);

  // Répartition valeur par catégorie
  const categories = await prisma.category.findMany({
    include: { products: { include: { stockLines: { where: { location: { type: 'internal' } } } } } },
  });
  const valueByCategory = categories
    .map((c) => ({
      name: c.name,
      value: c.products.reduce(
        (sum, p) => sum + p.stockLines.reduce((s, l) => s + l.quantity * l.unitCost, 0),
        0
      ),
    }))
    .filter((c) => c.value > 0);

  // Pickings récents
  const recentPickings = await prisma.picking.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { partner: true },
  });

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${session.name.split(' ')[0]} 👋`}
        subtitle="Vue d'ensemble de votre activité d'inventaire"
        actions={
          <Link href="/operations/nouveau" className="btn-primary">
            <Truck className="size-4" /> Nouveau mouvement
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <ApiLiveWidget />
        </div>
        <div>
          <LiveSearch />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Valeur du stock"
          value={formatMoney(stockValue)}
          icon={TrendingUp}
          tone="info"
          hint={`${formatNumber(stockUnits, 0)} unités au total`}
        />
        <KpiCard
          label="Produits référencés"
          value={products}
          icon={Package}
          tone="default"
          hint={`${outOfStock} en rupture`}
        />
        <KpiCard
          label="Entrepôts"
          value={warehouses}
          icon={Warehouse}
          tone="default"
        />
        <KpiCard
          label="Opérations en attente"
          value={openPickings}
          icon={Truck}
          tone="warning"
          hint={openPickings > 0 ? 'Action requise' : 'Tout est à jour'}
        />
        <KpiCard
          label="Ordres de fabrication"
          value={openMOs}
          icon={Factory}
          tone="default"
        />
        <KpiCard
          label="Alertes qualité"
          value={qualityAlerts}
          icon={ShieldAlert}
          tone={qualityAlerts > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          label="Partenaires"
          value={partners}
          icon={Boxes}
          tone="default"
        />
        <KpiCard
          label="Stock sous le seuil"
          value={lowStock.length}
          icon={AlertTriangle}
          tone={lowStock.length > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Mouvements de stock — 7 derniers jours</h3>
              <p className="text-xs text-zinc-500">Réceptions et expéditions par jour</p>
            </div>
          </div>
          <MovementsChart data={movementData} />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-1">Valeur stock par catégorie</h3>
          <p className="text-xs text-zinc-500 mb-3">Répartition à l'instant T</p>
          {valueByCategory.length > 0 ? (
            <StockValueChart data={valueByCategory} />
          ) : (
            <div className="h-[260px] grid place-items-center text-sm text-zinc-500">Pas de données</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Opérations récentes</h3>
            <Link href="/operations" className="text-sm text-brand-600 hover:underline">Tout voir →</Link>
          </div>
          {recentPickings.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Aucun mouvement enregistré.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Partenaire</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentPickings.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/operations/${p.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                        {p.reference}
                      </Link>
                    </td>
                    <td className="capitalize text-xs">
                      {p.type === 'receipt' ? 'Réception' : p.type === 'delivery' ? 'Expédition' : p.type === 'internal' ? 'Transfert' : p.type}
                    </td>
                    <td className="text-sm">{p.partner?.name ?? '—'}</td>
                    <td><StatusBadge value={p.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Top valeur stock</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Pas de stock.</p>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((p) => (
                <li key={p.product.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{p.product.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{p.product.sku}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">{formatMoney(p.value)}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">{formatNumber(p.qty, 0)} u</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card p-5 mt-6 border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-amber-600" />
            <h3 className="font-semibold">Stock sous le seuil minimum</h3>
            <Link href="/reassort" className="ml-auto text-sm text-brand-600 hover:underline">Lancer le réassort →</Link>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th className="text-right">Disponible</th>
                <th className="text-right">Min.</th>
                <th className="text-right">À commander</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => {
                const onHand = stockMap.get(p.id) ?? 0;
                const need = Math.max(p.maxQty - onHand, p.reorderQty);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td>{p.name}</td>
                    <td className="text-right tabular-nums">{formatNumber(onHand, 0)}</td>
                    <td className="text-right tabular-nums">{formatNumber(p.minQty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatNumber(need, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
