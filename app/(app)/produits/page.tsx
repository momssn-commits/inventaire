import Link from 'next/link';
import { Package, Plus, Download, Upload, Boxes, Coins, AlertTriangle, XCircle, SlidersHorizontal } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatMoneyShort, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;
const AVATARS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

function emojiFor(type: string, i: number) {
  if (type === 'service') return '🛠️';
  const set = ['📦', '🧰', '🖥️', '🪑', '🗄️', '🔩', '📎'];
  return set[i % set.length];
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; cat?: string; sort?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const sort = sp.sort ?? 'name_asc';

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

  const orderBy = sort === 'name_desc' ? { name: 'desc' as const } : { name: 'asc' as const };

  const [products, totalCount, categories, statRows, catCounts, grandTotal] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        stockLines: { where: { location: { type: 'internal' } } },
        uomStock: true,
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    // Stats sur l'ensemble filtré
    prisma.product.findMany({
      where,
      select: { type: true, minQty: true, stockLines: { where: { location: { type: 'internal' } }, select: { quantity: true, unitCost: true } } },
    }),
    prisma.product.groupBy({ by: ['categoryId'], where: { companyId: session.companyId, deletedAt: null }, _count: true }),
    prisma.product.count({ where: { companyId: session.companyId, deletedAt: null } }),
  ]);

  // Agrégats
  let stockValue = 0, lowCount = 0, outCount = 0;
  for (const p of statRows) {
    const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
    stockValue += p.stockLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    if (p.type !== 'service') {
      if (qty <= 0) outCount++;
      else if (p.minQty > 0 && qty < p.minQty) lowCount++;
    }
  }
  const catCountMap = new Map(catCounts.map((c) => [c.categoryId, c._count]));

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const buildUrl = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, type: sp.type, cat: sp.cat, sort: sp.sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/produits?${s}` : '/produits';
  };

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Produits"
        count={formatNumber(totalCount, 0)}
        subtitle="Gérez vos références, suivez les niveaux de stock et les valorisations en temps réel."
        actions={
          <>
            <a href="/api/export/produits" className="btn-secondary"><Download className="size-4" /> Exporter</a>
            <Link href="/produits/import" className="btn-secondary"><Upload className="size-4" /> Importer</Link>
            <Link href="/produits/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau produit</Link>
          </>
        }
      />

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 rise d1">
        <KpiCard label="Références actives" value={formatNumber(totalCount, 0)} icon={Boxes} tone="info" />
        <KpiCard label="Valeur du stock" value={formatMoneyShort(stockValue)} icon={Coins} tone="success" />
        <KpiCard label="Produits en stock faible" value={lowCount} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Ruptures à traiter" value={outCount} icon={XCircle} tone="danger" />
      </section>

      {/* Filtres — chips catégories + tri */}
      <div className="flex items-center gap-2.5 flex-wrap mb-4 rise d2">
        <Link href={buildUrl({ cat: undefined, page: undefined })} className={`chip ${!sp.cat ? 'active' : ''}`}>
          Tous <span className="n">{grandTotal}</span>
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={buildUrl({ cat: c.id, page: undefined })} className={`chip ${sp.cat === c.id ? 'active' : ''}`}>
            {c.name} <span className="n">{catCountMap.get(c.id) ?? 0}</span>
          </Link>
        ))}
        <div className="flex-1" />
        <form className="sort flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px]"
          style={{ background: '#fff', border: '1px solid rgb(232 236 244)', boxShadow: 'var(--shadow-sm)', color: 'rgb(100 116 139)' }}>
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          <SlidersHorizontal className="size-[15px]" />
          <select name="sort" defaultValue={sort} className="bg-transparent font-semibold outline-none cursor-pointer" style={{ color: 'rgb(11 18 32)' }}>
            <option value="name_asc">Nom (A→Z)</option>
            <option value="name_desc">Nom (Z→A)</option>
          </select>
          <button type="submit" className="text-[12px] font-semibold" style={{ color: 'rgb(37 99 235)' }}>Trier</button>
        </form>
      </div>

      {/* Tableau */}
      <div className="card overflow-x-auto rise d3">
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
                <th>Produit</th>
                <th>SKU</th>
                <th>Suivi</th>
                <th className="text-right">Prix unitaire</th>
                <th className="text-right">Qté</th>
                <th>Niveau de stock</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
                const isService = p.type === 'service';
                const out = !isService && qty <= 0;
                const low = !isService && !out && p.minQty > 0 && qty < p.minQty;
                const target = p.minQty > 0 ? p.minQty * 2 : Math.max(qty, 1);
                let pct = out ? 2 : Math.min(100, Math.round((qty / target) * 100));
                let g = out ? 'g-danger' : low ? 'g-warn' : 'g-ok';
                if (g === 'g-ok') pct = Math.max(pct, 55);

                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3.5">
                        <div className={`prod-img ${AVATARS[i % AVATARS.length]}`}>{emojiFor(p.type, i)}</div>
                        <div className="min-w-0">
                          <Link href={`/produits/${p.id}`} className="font-semibold text-[14.5px] hover:text-[color:rgb(37_99_235)] transition-colors block truncate max-w-[280px]">
                            {p.name}
                          </Link>
                          <div className="text-[12.5px] mt-0.5" style={{ color: 'rgb(100 116 139)' }}>
                            {p.category?.name ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="sku">{p.sku}</span></td>
                    <td className="text-[13.5px]" style={{ color: 'rgb(100 116 139)' }}>
                      {p.tracking === 'serial' ? 'N° série' : p.tracking === 'lot' ? 'Par lot' : '—'}
                    </td>
                    <td className="text-right mono text-[13.5px]">{formatMoney(p.salePrice || p.cost)}</td>
                    <td className="text-right mono text-[13.5px] font-semibold">{isService ? '—' : formatNumber(qty, 0)}</td>
                    <td>
                      {isService ? (
                        <span className="text-[13px]" style={{ color: 'rgb(100 116 139)' }}>—</span>
                      ) : (
                        <div className={`gauge ${g}`}>
                          <div className="gauge-track"><div className="gauge-fill" style={{ width: `${pct}%` }} /></div>
                          <span className="gauge-label">{pct}%</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {isService ? (
                        <span className="badge b-info dot">Service</span>
                      ) : out ? (
                        <span className="badge b-danger dot">Rupture</span>
                      ) : low ? (
                        <span className="badge b-warn dot">Stock faible</span>
                      ) : (
                        <span className="badge b-ok dot">En stock</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pied de tableau / pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-[13.5px]"
            style={{ color: 'rgb(100 116 139)', background: '#fbfcfe', borderTop: '1px solid rgb(232 236 244)' }}>
            <span>
              Affichage de <strong style={{ color: 'rgb(11 18 32)' }}>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)}</strong> sur{' '}
              <strong style={{ color: 'rgb(11 18 32)' }}>{formatNumber(totalCount, 0)}</strong> produits
            </span>
            {totalPages > 1 && (
              <div className="flex gap-1.5">
                <PageBtn href={page > 1 ? buildUrl({ page: String(page - 1) }) : undefined}>‹</PageBtn>
                {pageWindow(page, totalPages).map((n, idx) =>
                  n === '…' ? (
                    <span key={`e${idx}`} className="grid place-items-center min-w-[34px] h-[34px]">…</span>
                  ) : (
                    <PageBtn key={n} href={buildUrl({ page: n === 1 ? undefined : String(n) })} current={n === page}>{n}</PageBtn>
                  )
                )}
                <PageBtn href={page < totalPages ? buildUrl({ page: String(page + 1) }) : undefined}>›</PageBtn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PageBtn({ href, current, children }: { href?: string; current?: boolean; children: React.ReactNode }) {
  const base = 'grid place-items-center min-w-[34px] h-[34px] rounded-[10px] text-[13.5px] font-medium transition';
  if (current) {
    return (
      <span className={`${base} text-white`} style={{ background: 'linear-gradient(135deg,#2563eb,#4f8bff)', boxShadow: '0 6px 14px -4px rgba(37,99,235,.5)' }}>
        {children}
      </span>
    );
  }
  if (!href) return <span className={`${base} opacity-30`} style={{ color: 'rgb(100 116 139)' }}>{children}</span>;
  return <Link href={href} className={`${base} hover:bg-slate-100`} style={{ color: 'rgb(100 116 139)' }}>{children}</Link>;
}

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (current > 3) out.push('…');
  for (let n = Math.max(2, current - 1); n <= Math.min(total - 1, current + 1); n++) out.push(n);
  if (current < total - 2) out.push('…');
  out.push(total);
  return out;
}
