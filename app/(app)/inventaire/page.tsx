import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createCountSheet(formData: FormData) {
  'use server';
  const session = await requireSession();
  const warehouseId = String(formData.get('warehouseId') ?? '');
  if (!warehouseId) redirect('/inventaire?error=missing');

  const reference = await nextSequence('COUNT', 'INV/', 5);

  const lines = await prisma.stockLine.findMany({
    where: {
      location: { warehouseId, type: 'internal' },
      product: { companyId: session.companyId },
    },
    include: { product: true, lot: true },
  });

  const sheet = await prisma.countSheet.create({
    data: {
      reference,
      state: 'in_progress',
      scheduledAt: new Date(),
      notes: `Comptage généré pour entrepôt ${warehouseId}`,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          locationId: l.locationId,
          lotName: l.lot?.name,
          qtyTheoretical: l.quantity,
          qtyCounted: l.quantity,
          qtyDiff: 0,
        })),
      },
    },
  });

  redirect(`/inventaire/${sheet.id}`);
}

export default async function CountsPage() {
  const session = await requireSession();
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
  });
  const sheets = await prisma.countSheet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { lines: true } } },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Comptages d'inventaire"
        subtitle="Comptages ponctuels et cycliques avec ajustements automatiques"
        module="M2"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="card overflow-x-auto">
            {sheets.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Aucun comptage" description="Démarrez un nouveau comptage." />
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th>Lignes</th>
                    <th>Date</th>
                    <th>Validé le</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/inventaire/${s.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                          {s.reference}
                        </Link>
                      </td>
                      <td><StatusBadge value={s.state} /></td>
                      <td className="tabular-nums">{formatNumber(s._count.lines, 0)}</td>
                      <td>{formatDate(s.scheduledAt)}</td>
                      <td>{formatDate(s.validatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouveau comptage</h3>
          <form action={createCountSheet} className="space-y-3">
            <div>
              <label className="label">Entrepôt à compter *</label>
              <select name="warehouseId" required className="input">
                <option value="">—</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-500">
              Une feuille de comptage sera générée à partir du stock théorique actuel pour validation et ajustement.
            </p>
            <button type="submit" className="btn-primary w-full">Démarrer le comptage</button>
          </form>
        </div>
      </div>
    </div>
  );
}
