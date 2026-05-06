import Link from 'next/link';
import {
  Boxes, Filter, Download, ArrowLeftRight, AlertTriangle, BarChart3,
  Package, Warehouse, MapPin, ChevronLeft, ChevronRight, Tag,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatNumber, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { getStockAlerts } from '@/lib/stock';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    warehouse?: string;
    category?: string;
    only_positive?: string;
    page?: string;
  }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const onlyPositive = sp.only_positive !== 'false';

  const where: any = {
    product: { companyId: session.companyId, deletedAt: null },
    location: { type: 'internal' },
    ...(onlyPositive ? { quantity: { gt: 0 } } : {}),
  };
  if (sp.warehouse) where.location = { ...where.location, warehouseId: sp.warehouse };
  if (sp.category) where.product = { ...where.product, categoryId: sp.category };
  if (sp.q) {
    where.product = {
      ...where.product,
      OR: [
        { name: { contains: sp.q } },
        { sku: { contains: sp.q } },
      ],
    };
  }

  const [stockLines, totalCount, warehouses, categories, agg, alerts] = await Promise.all([
    prisma.stockLine.findMany({
      where,
      include: {
        product: { include: { uomStock: true } },
        location: { include: { warehouse: true } },
        lot: true,
      },
      orderBy: [{ quantity: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.stockLine.count({ where }),
    prisma.warehouse.findMany({ where: { companyId: session.companyId, deletedAt: null }, orderBy: { code: 'asc' } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    // Aggregations pour les KPI : ne tient pas compte des filtres pour donner la vue globale
    (async () => {
      const lines = await prisma.stockLine.findMany({
        where: {
          product: { companyId: session.companyId, deletedAt: null },
          location: { type: 'internal' },
        },
        select: { quantity: true, unitCost: true, productId: true, locationId: true },
      });
      const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
      const totalValue = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
      const distinctProducts = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.productId)).size;
      const distinctLocations = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.locationId)).size;
      return { totalUnits, totalValue, distinctProducts, distinctLocations };
    })(),
    getStockAlerts(session.companyId),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.warehouse) params.set('warehouse', sp.warehouse);
    if (sp.category) params.set('category', sp.category);
    if (sp.only_positive) params.set('only_positive', sp.only_positive);
    if (p !== 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/stock?${s}` : '/stock';
  };

  const totalAlerts =
    alerts.ruptures.length + alerts.sousSeuil.length + alerts.surStock.length + alerts.oldStock.length;

  return (
    <div>
      <PageHeader
        title="Gestion de stock"
        subtitle="Vue globale du stock, alertes, transferts et analyses"
        module="Stock"
        actions={
          <>
            <Link href="/stock/alertes" className="btn-secondary">
              <AlertTriangle className="size-4" /> Alertes
              {totalAlerts > 0 && (
                <span className="badge bg-amber-500 text-white text-[10px] ml-1">{totalAlerts}</span>
              )}
            </Link>
            <Link href="/stock/transfert" className="btn-secondary">
              <ArrowLeftRight className="size-4" /> Transfert rapide
            </Link>
            <Link href="/stock/abc" className="btn-secondary">
              <BarChart3 className="size-4" /> Analyse ABC
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Valeur totale du stock"
          value={formatMoney(agg.totalValue)}
          icon={Boxes}
          tone="info"
        />
        <KpiCard
          label="Unités en stock"
          value={formatNumber(agg.totalUnits, 0)}
          icon={Package}
          tone="default"
        />
        <KpiCard
          label="Produits référencés"
          value={agg.distinctProducts}
          icon={Tag}
          tone="default"
        />
        <KpiCard
          label="Emplacements occupés"
          value={agg.distinctLocations}
          icon={MapPin}
          tone="default"
        />
      </div>

      <div className="card p-4 mb-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Recherche</label>
            <input name="q" defaultValue={sp.q ?? ''} placeholder="SKU, nom de produit…" className="input" />
          </div>
          <div className="min-w-[180px]">
            <label className="label">Entrepôt</label>
            <select name="warehouse" defaultValue={sp.warehouse ?? ''} className="input">
              <option value="">Tous</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="label">Catégorie</label>
            <select name="category" defaultValue={sp.category ?? ''} className="input">
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" name="only_positive" value="true" defaultChecked={onlyPositive} className="size-4" />
            Stocks positifs uniquement
          </label>
          <button type="submit" className="btn-secondary"><Filter className="size-4" /> Filtrer</button>
          <button type="button" className="btn-ghost" disabled>
            <Download className="size-4" /> Export CSV
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto mb-4">
        {stockLines.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Aucune ligne de stock"
            description="Aucun stock ne correspond à vos filtres."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th>Entrepôt</th>
                <th>Emplacement</th>
                <th>Lot / N° série</th>
                <th>État</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Réservé</th>
                <th className="text-right">Coût unit.</th>
                <th className="text-right">Valeur</th>
                <th className="text-right">MAJ</th>
              </tr>
            </thead>
            <tbody>
              {stockLines.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.product.sku}</td>
                  <td>
                    <Link href={`/produits/${l.product.id}`} className="text-brand-600 hover:underline">
                      {l.product.name}
                    </Link>
                  </td>
                  <td className="text-xs">
                    {l.location.warehouse ? (
                      <span className="badge bg-zinc-100 dark:bg-zinc-800 font-mono">
                        <Warehouse className="size-3 mr-1" />
                        {l.location.warehouse.code}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-xs font-mono text-zinc-500">{l.location.fullPath}</td>
                  <td className="text-xs font-mono">
                    {l.lot ? (
                      <Link href={`/tracabilite?q=${encodeURIComponent(l.lot.name)}`} className="text-brand-600 hover:underline">
                        {l.lot.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="text-xs">
                    {l.lot?.condition && (
                      <span className={`badge text-[11px] ${
                        l.lot.condition === 'BON ETAT'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : l.lot.condition === 'MAUVAIS ETAT'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      }`}>
                        {l.lot.condition}
                      </span>
                    )}
                  </td>
                  <td className={`text-right tabular-nums ${l.quantity <= 0 ? 'text-red-600' : ''}`}>
                    {formatNumber(l.quantity, 0)} {l.product.uomStock.symbol}
                  </td>
                  <td className="text-right tabular-nums text-sm text-zinc-500">
                    {l.reserved > 0 ? formatNumber(l.reserved, 0) : '—'}
                  </td>
                  <td className="text-right tabular-nums text-sm text-zinc-500">
                    {formatMoney(l.unitCost)}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {formatMoney(l.quantity * l.unitCost)}
                  </td>
                  <td className="text-right text-xs text-zinc-500">{formatDate(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          {totalCount > 0 ? (
            <>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)} sur{' '}
              <span className="font-medium">{formatNumber(totalCount, 0)}</span> ligne(s) de stock
            </>
          ) : (
            '0 ligne'
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link href={buildPageUrl(page - 1)} className="btn-ghost p-1.5"><ChevronLeft className="size-4" /></Link>
            ) : (
              <button className="btn-ghost p-1.5 opacity-30" disabled><ChevronLeft className="size-4" /></button>
            )}
            <span className="text-xs px-2 tabular-nums">{page} / {totalPages}</span>
            {page < totalPages ? (
              <Link href={buildPageUrl(page + 1)} className="btn-ghost p-1.5"><ChevronRight className="size-4" /></Link>
            ) : (
              <button className="btn-ghost p-1.5 opacity-30" disabled><ChevronRight className="size-4" /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
