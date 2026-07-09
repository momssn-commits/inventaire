import Link from 'next/link';
import { Archive, Filter, Tag, Calendar, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

const CONDITION_COLORS: Record<string, string> = {
  'BON ETAT': 'bg-emerald-100 text-emerald-700',
  'MAUVAIS ETAT': 'bg-red-100 text-red-700',
  'HORS SERVICE': 'bg-zinc-100 text-zinc-600',
};

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; productId?: string; expired?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const now = new Date();

  const where: any = {
    product: { companyId: session.companyId, deletedAt: null },
    ...(sp.productId ? { productId: sp.productId } : {}),
    ...(sp.q
      ? { OR: [{ name: { contains: sp.q } }, { product: { name: { contains: sp.q } } }] }
      : {}),
    ...(sp.expired === '1' ? { expirationDate: { lt: now } } : {}),
  };

  const [lots, totalCount, products] = await Promise.all([
    prisma.lot.findMany({
      where,
      include: {
        product: true,
        stockLines: {
          where: { location: { type: 'internal' } },
          select: { quantity: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.lot.count({ where }),
    prisma.product.findMany({
      where: { companyId: session.companyId, deletedAt: null, tracking: { in: ['lot', 'serial'] } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.productId) params.set('productId', sp.productId);
    if (sp.expired) params.set('expired', sp.expired);
    if (p !== 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/lots?${s}` : '/lots';
  };

  const expiredCount = await prisma.lot.count({
    where: { product: { companyId: session.companyId }, expirationDate: { lt: now } },
  });

  return (
    <div>
      <PageHeader
        title="Lots & Numéros de série"
        subtitle="Traçabilité des lots de production et numéros de série"
        module="M1"
      />

      {expiredCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertTriangle className="size-4 shrink-0" />
          <span><strong>{expiredCount}</strong> lot{expiredCount > 1 ? 's' : ''} expiré{expiredCount > 1 ? 's' : ''} —{' '}
            <a href="/lots?expired=1" className="underline">voir les lots expirés</a>
          </span>
        </div>
      )}

      <div className="card p-4 mb-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Recherche</label>
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Numéro de lot, produit…" className="input" />
          </div>
          <div className="min-w-[200px]">
            <label className="label">Produit</label>
            <select name="productId" defaultValue={sp.productId ?? ''} className="input">
              <option value="">Tous</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input type="checkbox" name="expired" value="1" id="exp" defaultChecked={sp.expired === '1'} className="size-4" />
            <label htmlFor="exp" className="text-sm text-zinc-700">Expirés seulement</label>
          </div>
          <button type="submit" className="btn-secondary"><Filter className="size-4" /> Filtrer</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        {lots.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Aucun lot"
            description="Les lots et numéros de série apparaissent ici lors des réceptions ou de la saisie manuelle."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>N° Lot / Série</th>
                <th>Produit</th>
                <th>Type</th>
                <th>Marque</th>
                <th>État</th>
                <th>Affectation</th>
                <th className="text-right">Stock</th>
                <th>Expiration</th>
                <th>Retrait</th>
                <th>Alerte</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const qty = lot.stockLines.reduce((s, l) => s + l.quantity, 0);
                const expired = lot.expirationDate && lot.expirationDate < now;
                return (
                  <tr key={lot.id}>
                    <td>
                      <span className="font-mono text-sm font-medium">{lot.name}</span>
                      {lot.isSerial && (
                        <span className="ml-1.5 badge text-xs" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>Série</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/produits/${lot.productId}`} className="text-indigo-400 hover:underline text-sm">
                        {lot.product.name}
                      </Link>
                      <div className="text-xs text-zinc-500 font-mono">{lot.product.sku}</div>
                    </td>
                    <td className="text-xs">{lot.isSerial ? 'N° Série' : 'Lot'}</td>
                    <td className="text-xs">{lot.brand ?? '—'}</td>
                    <td>
                      {lot.condition ? (
                        <span className={`badge text-xs ${CONDITION_COLORS[lot.condition] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {lot.condition}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs">{lot.serviceName ?? '—'}</td>
                    <td className="text-right tabular-nums">
                      <span className={qty === 0 ? 'text-zinc-500' : 'font-medium'}>{qty}</span>
                    </td>
                    <td className="text-xs">
                      {lot.expirationDate ? (
                        <span className={expired ? 'text-red-400 font-medium' : ''}>
                          <Calendar className="size-3 inline mr-1" />
                          {formatDate(lot.expirationDate)}
                          {expired && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs">{lot.removalDate ? formatDate(lot.removalDate) : '—'}</td>
                    <td className="text-xs">{lot.alertDate ? (
                      <span className={lot.alertDate < now ? 'text-amber-400' : ''}>{formatDate(lot.alertDate)}</span>
                    ) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
