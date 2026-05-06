import Link from 'next/link';
import { Package, Plus, Filter, Download, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; cat?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const where = {
    companyId: session.companyId,
    deletedAt: null,
    ...(sp.q
      ? {
          OR: [
            { name: { contains: sp.q } },
            { sku: { contains: sp.q } },
            { barcode: { contains: sp.q } },
          ],
        }
      : {}),
    ...(sp.type ? { type: sp.type } : {}),
    ...(sp.cat ? { categoryId: sp.cat } : {}),
  };

  const [products, totalCount, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        stockLines: { where: { location: { type: 'internal' } } },
        uomStock: true,
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.type) params.set('type', sp.type);
    if (sp.cat) params.set('cat', sp.cat);
    if (p !== 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/produits?${s}` : '/produits';
  };

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle="Gestion du catalogue, des unités, lots et numéros de série"
        module="M1"
        actions={
          <>
            <button className="btn-secondary"><Download className="size-4" /> Exporter</button>
            <Link href="/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau produit</Link>
          </>
        }
      />

      <div className="card p-4 mb-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Recherche</label>
            <input name="q" defaultValue={sp.q ?? ''} placeholder="SKU, nom, code-barres…" className="input" />
          </div>
          <div className="min-w-[160px]">
            <label className="label">Type</label>
            <select name="type" defaultValue={sp.type ?? ''} className="input">
              <option value="">Tous</option>
              <option value="storable">Stockable</option>
              <option value="consumable">Consommable</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="label">Catégorie</label>
            <select name="cat" defaultValue={sp.cat ?? ''} className="input">
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary"><Filter className="size-4" /> Filtrer</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Aucun produit"
            description="Créez votre premier produit pour commencer."
            action={<Link href="/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau produit</Link>}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Désignation</th>
                <th>Type</th>
                <th>Suivi</th>
                <th>Catégorie</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Coût</th>
                <th className="text-right">Prix vente</th>
                <th className="text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
                const value = p.stockLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
                const lowStock = p.minQty > 0 && qty < p.minQty;
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.sku}</td>
                    <td>
                      <Link href={`/produits/${p.id}`} className="text-brand-600 hover:underline font-medium">
                        {p.name}
                      </Link>
                      {p.barcode && (
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">{p.barcode}</div>
                      )}
                    </td>
                    <td className="text-xs">
                      {p.type === 'storable' ? 'Stockable' : p.type === 'consumable' ? 'Consommable' : 'Service'}
                    </td>
                    <td className="text-xs">
                      {p.tracking === 'serial' ? 'Numéro série' : p.tracking === 'lot' ? 'Par lot' : '—'}
                    </td>
                    <td className="text-xs">
                      {p.category && (
                        <span className="badge bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          <Tag className="size-3 mr-1" /> {p.category.name}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {p.type === 'service' ? '—' : (
                        <span className={lowStock ? 'text-amber-600 font-medium' : ''}>
                          {formatNumber(qty, 0)} {p.uomStock.symbol}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                      {formatMoney(p.cost)}
                    </td>
                    <td className="text-right tabular-nums text-sm">
                      {formatMoney(p.salePrice)}
                    </td>
                    <td className="text-right tabular-nums text-sm font-medium">
                      {p.type === 'service' ? '—' : formatMoney(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          {totalCount > 0 ? (
            <>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)} sur{' '}
              <span className="font-medium">{totalCount}</span> produit(s)
            </>
          ) : (
            '0 produit'
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
