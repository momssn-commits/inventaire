import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { transferStock } from '@/lib/stock';
import { nextSequence } from '@/lib/sequence';
import { formatNumber, formatMoney, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function doTransfer(formData: FormData) {
  'use server';
  const session = await requireSession();
  const productId = String(formData.get('productId') ?? '');
  const fromLocationId = String(formData.get('fromLocationId') ?? '');
  const toLocationId = String(formData.get('toLocationId') ?? '');
  const lotId = String(formData.get('lotId') ?? '') || null;
  const qty = Number(formData.get('qty') ?? 0);
  const notes = String(formData.get('notes') ?? '') || null;

  if (!productId || !fromLocationId || !toLocationId || qty <= 0) {
    redirect('/stock/transfert?error=missing');
  }

  try {
    // Effectuer le transfert atomique
    const result = await transferStock({ productId, fromLocationId, toLocationId, qty, lotId });

    // Tracer le transfert via un Picking interne (audit + traçabilité)
    const reference = await nextSequence('PICKING_INTERNAL', 'WH/INT/', 5);
    const lot = lotId ? await prisma.lot.findUnique({ where: { id: lotId } }) : null;
    const picking = await prisma.picking.create({
      data: {
        reference,
        type: 'internal',
        state: 'done',
        scheduledAt: new Date(),
        doneAt: new Date(),
        notes,
        companyId: session.companyId,
        lines: {
          create: [{
            productId,
            qtyDemand: qty,
            qtyDone: qty,
            fromLocationId,
            toLocationId,
            lotId,
            lotName: lot?.name,
          }],
        },
      },
    });

    await logAudit({
      action: 'transfer', entity: 'picking', entityId: picking.id,
      newValue: { qty, productId, from: fromLocationId, to: toLocationId },
      userId: session.userId, companyId: session.companyId,
    });

    redirect(`/stock/transfert?ok=${reference}`);
  } catch (e: any) {
    redirect(`/stock/transfert?error=${encodeURIComponent(e.message ?? 'unknown')}`);
  }
}

export default async function TransfertPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; product?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const [products, locations, recentTransfers] = await Promise.all([
    prisma.product.findMany({
      where: { companyId: session.companyId, deletedAt: null, type: 'storable' },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    prisma.location.findMany({
      where: { type: 'internal' },
      include: { warehouse: true },
      orderBy: { fullPath: 'asc' },
    }),
    prisma.picking.findMany({
      where: { companyId: session.companyId, type: 'internal', state: 'done' },
      orderBy: { doneAt: 'desc' },
      take: 10,
      include: {
        lines: {
          include: {
            product: true,
            fromLocation: { include: { warehouse: true } },
            toLocation: { include: { warehouse: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Transfert rapide de stock"
        subtitle="Déplacer du stock d'un emplacement à un autre (mouvement atomique)"
        module="Stock"
        actions={<Link href="/stock" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      {sp.ok && (
        <div className="card p-4 mb-4 border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20">
          <div className="text-sm text-emerald-800 dark:text-emerald-200">
            ✅ Transfert effectué : <span className="font-mono">{sp.ok}</span>
          </div>
        </div>
      )}
      {sp.error && (
        <div className="card p-4 mb-4 border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20">
          <div className="text-sm text-red-800 dark:text-red-200">
            ❌ {sp.error === 'missing' ? 'Champs requis manquants.' : decodeURIComponent(sp.error)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ArrowLeftRight className="size-4" /> Nouveau transfert
          </h3>
          <form action={doTransfer} className="space-y-3">
            <div>
              <label className="label">Produit *</label>
              <select name="productId" required className="input" defaultValue={sp.product ?? ''}>
                <option value="">— Choisir un produit —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Emplacement source *</label>
              <select name="fromLocationId" required className="input">
                <option value="">— Source —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse?.code ? `[${l.warehouse.code}] ` : ''}{l.fullPath}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Emplacement destination *</label>
              <select name="toLocationId" required className="input">
                <option value="">— Destination —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse?.code ? `[${l.warehouse.code}] ` : ''}{l.fullPath}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantité *</label>
              <input
                type="number"
                step="1"
                min="1"
                name="qty"
                required
                className="input"
                placeholder="ex: 1"
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="input" placeholder="Motif du transfert (optionnel)" />
            </div>
            <button type="submit" className="btn-primary w-full">
              <ArrowLeftRight className="size-4" /> Effectuer le transfert
            </button>
            <p className="text-xs text-zinc-500">
              Le transfert est appliqué immédiatement et tracé via un mouvement WH/INT.
              Si vous suivez par lot, sélectionnez le lot dans la fiche produit après transfert.
            </p>
          </form>
        </div>

        <div className="card overflow-x-auto lg:col-span-2 h-fit">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="size-4" /> Transferts récents
            </h3>
          </div>
          {recentTransfers.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Aucun transfert récent"
              description="Les 10 derniers transferts internes apparaîtront ici."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>De</th>
                  <th>Vers</th>
                  <th className="text-right">Qté</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.map((p) =>
                  p.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/operations/${p.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                          {p.reference}
                        </Link>
                      </td>
                      <td className="text-xs text-zinc-500">{formatDate(p.doneAt)}</td>
                      <td className="text-sm">{l.product.name}</td>
                      <td className="text-xs font-mono text-zinc-500">
                        {l.fromLocation?.warehouse?.code ?? ''} {l.fromLocation?.fullPath ?? '—'}
                      </td>
                      <td className="text-xs font-mono text-zinc-500">
                        {l.toLocation?.warehouse?.code ?? ''} {l.toLocation?.fullPath ?? '—'}
                      </td>
                      <td className="text-right tabular-nums">{formatNumber(l.qtyDone, 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
