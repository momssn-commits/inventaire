import Link from 'next/link';
import { History, ArrowDown, ArrowUp, Tag } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function findLotWithDetails(name: string, companyId: string) {
  const lot = await prisma.lot.findFirst({
    where: {
      OR: [{ name }, { name: { contains: name } }],
      product: { companyId },
    },
    include: { product: true },
  });
  if (!lot) return null;
  const [movements, stockLines] = await Promise.all([
    prisma.pickingLine.findMany({
      where: { lotName: lot.name, productId: lot.productId },
      include: {
        picking: { include: { partner: true } },
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { picking: { doneAt: 'desc' } },
    }),
    prisma.stockLine.findMany({
      where: { lotId: lot.id },
      include: { location: { include: { warehouse: true } } },
    }),
  ]);
  return { lot, movements, stockLines };
}

export default async function TracabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const q = sp.q?.trim();

  const result = q ? await findLotWithDetails(q, session.companyId) : null;
  const lot = result?.lot ?? null;
  const movements = result?.movements ?? [];
  const stockLines = result?.stockLines ?? [];

  // Lots disponibles pour suggestion
  const recentLots = await prisma.lot.findMany({
    where: { product: { companyId: session.companyId } },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title="Traçabilité"
        subtitle="Suivi ascendant et descendant d'un lot ou d'un numéro de série"
      />

      <div className="card p-4 mb-4">
        <form className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Rechercher un lot ou numéro de série</label>
            <input
              name="q"
              defaultValue={q ?? ''}
              className="input"
              placeholder="Ex: L-2026-CV-A, SN-VEU-2026-001…"
            />
          </div>
          <button type="submit" className="btn-primary">Rechercher</button>
        </form>

        {!q && recentLots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-zinc-500 self-center">Lots récents :</span>
            {recentLots.map((l) => (
              <Link
                key={l.id}
                href={`/tracabilite?q=${encodeURIComponent(l.name)}`}
                className="badge bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs"
              >
                <Tag className="size-3 mr-1" />
                {l.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {!q ? (
        <EmptyState icon={History} title="Lancez une recherche" description="Saisissez un identifiant de lot ou numéro de série pour visualiser sa traçabilité." />
      ) : !lot ? (
        <EmptyState icon={History} title="Aucun résultat" description={`Aucun lot ne correspond à « ${q} ».`} />
      ) : (
        <>
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-12 rounded-lg bg-brand-100 dark:bg-brand-950/40 grid place-items-center">
                <Tag className="size-6 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold font-mono">{lot.name}</h2>
                <p className="text-sm text-zinc-500">
                  {lot.isSerial ? 'Numéro de série' : 'Lot'} • Produit : {' '}
                  <Link href={`/produits/${lot.productId}`} className="text-brand-600 hover:underline">
                    {lot.product.name} ({lot.product.sku})
                  </Link>
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Date de création</dt>
                <dd className="font-medium">{formatDate(lot.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">État</dt>
                <dd className="font-medium">{lot.condition ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Marque</dt>
                <dd className="font-medium">{lot.brand ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Service</dt>
                <dd className="font-medium">{lot.serviceName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Péremption</dt>
                <dd className="font-medium">{formatDate(lot.expirationDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Quantité actuelle</dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(stockLines.reduce((s, l) => s + l.quantity, 0), 0)}
                </dd>
              </div>
              {lot.specifications && (
                <div className="col-span-2 md:col-span-4">
                  <dt className="text-xs text-zinc-500">Spécifications</dt>
                  <dd className="font-medium text-sm">{lot.specifications}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowDown className="size-4 text-emerald-600" /> Traçabilité ascendante (origine)
              </h3>
              {movements.filter((m) => m.picking.type === 'receipt' || m.picking.type === 'manufacturing').length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune réception trouvée.</p>
              ) : (
                <ul className="space-y-2">
                  {movements
                    .filter((m) => m.picking.type === 'receipt' || m.picking.type === 'manufacturing')
                    .map((m) => (
                      <li key={m.id} className="text-sm border-l-2 border-emerald-500 pl-3">
                        <div className="flex justify-between">
                          <Link href={`/operations/${m.picking.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                            {m.picking.reference}
                          </Link>
                          <span className="text-xs text-zinc-500">{formatDate(m.picking.doneAt ?? m.picking.scheduledAt)}</span>
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {m.picking.partner?.name ?? '—'} • {formatNumber(m.qtyDone, 0)} u
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowUp className="size-4 text-blue-600" /> Traçabilité descendante (destination)
              </h3>
              {movements.filter((m) => m.picking.type === 'delivery' || m.picking.type === 'internal').length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune sortie trouvée.</p>
              ) : (
                <ul className="space-y-2">
                  {movements
                    .filter((m) => m.picking.type === 'delivery' || m.picking.type === 'internal')
                    .map((m) => (
                      <li key={m.id} className="text-sm border-l-2 border-blue-500 pl-3">
                        <div className="flex justify-between">
                          <Link href={`/operations/${m.picking.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                            {m.picking.reference}
                          </Link>
                          <span className="text-xs text-zinc-500">{formatDate(m.picking.doneAt ?? m.picking.scheduledAt)}</span>
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {m.picking.partner?.name ?? m.toLocation?.fullPath ?? '—'} • {formatNumber(m.qtyDone, 0)} u
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          {stockLines.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold mb-3">Position actuelle du stock</h3>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Entrepôt</th>
                    <th>Emplacement</th>
                    <th className="text-right">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.location.warehouse?.name ?? '—'}</td>
                      <td className="font-mono text-xs">{l.location.fullPath}</td>
                      <td className="text-right tabular-nums">{formatNumber(l.quantity, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
