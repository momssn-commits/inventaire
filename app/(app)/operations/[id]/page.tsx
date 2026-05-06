import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Check, X, Plus, Trash2, Printer } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { applyMovement } from '@/lib/stock';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

async function addLine(formData: FormData) {
  'use server';
  await requireSession();
  const pickingId = String(formData.get('pickingId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const qty = Number(formData.get('qty') ?? 0);
  const fromLocationId = String(formData.get('fromLocationId') ?? '') || null;
  const toLocationId = String(formData.get('toLocationId') ?? '') || null;
  const lotName = String(formData.get('lotName') ?? '') || null;
  if (!pickingId || !productId || qty <= 0) redirect(`/operations/${pickingId}`);

  await prisma.pickingLine.create({
    data: {
      pickingId, productId, qtyDemand: qty, qtyDone: qty,
      fromLocationId, toLocationId, lotName,
    },
  });
  redirect(`/operations/${pickingId}`);
}

async function removeLine(formData: FormData) {
  'use server';
  await requireSession();
  const lineId = String(formData.get('lineId') ?? '');
  const pickingId = String(formData.get('pickingId') ?? '');
  await prisma.pickingLine.delete({ where: { id: lineId } });
  redirect(`/operations/${pickingId}`);
}

async function confirmPicking(formData: FormData) {
  'use server';
  await requireSession();
  const pickingId = String(formData.get('pickingId') ?? '');
  await prisma.picking.update({ where: { id: pickingId }, data: { state: 'confirmed' } });
  redirect(`/operations/${pickingId}`);
}

async function cancelPicking(formData: FormData) {
  'use server';
  await requireSession();
  const pickingId = String(formData.get('pickingId') ?? '');
  await prisma.picking.update({ where: { id: pickingId }, data: { state: 'cancelled' } });
  redirect(`/operations/${pickingId}`);
}

async function validatePicking(formData: FormData) {
  'use server';
  const session = await requireSession();
  const pickingId = String(formData.get('pickingId') ?? '');

  const picking = await prisma.picking.findUnique({
    where: { id: pickingId },
    include: { lines: { include: { product: true } } },
  });
  if (!picking) redirect('/operations?error=notfound');
  if (picking.state === 'done') redirect(`/operations/${pickingId}`);

  // Emplacements virtuels par défaut
  const supplierLoc = await prisma.location.findFirst({ where: { type: 'supplier' } });
  const customerLoc = await prisma.location.findFirst({ where: { type: 'customer' } });

  await prisma.$transaction(async (tx) => {
    for (const line of picking.lines) {
      let fromId = line.fromLocationId;
      let toId = line.toLocationId;
      // Auto-fill virtual locations selon type
      if (picking.type === 'receipt' && !fromId) fromId = supplierLoc?.id ?? null;
      if (picking.type === 'delivery' && !toId) toId = customerLoc?.id ?? null;

      let lotId: string | null = null;
      if (line.lotName) {
        const lot = await tx.lot.upsert({
          where: { productId_name: { productId: line.productId, name: line.lotName } },
          update: {},
          create: {
            name: line.lotName,
            productId: line.productId,
            isSerial: line.product.tracking === 'serial',
          },
        });
        lotId = lot.id;
      }

      const qty = line.qtyDone > 0 ? line.qtyDone : line.qtyDemand;
      await applyMovement(tx, {
        productId: line.productId,
        fromLocationId: fromId,
        toLocationId: toId,
        qty,
        lotId,
        unitCost: line.product.cost,
      });

      if (lotId) {
        await tx.pickingLine.update({
          where: { id: line.id },
          data: { lotId, qtyDone: qty },
        });
      } else {
        await tx.pickingLine.update({
          where: { id: line.id },
          data: { qtyDone: qty },
        });
      }
    }
    await tx.picking.update({
      where: { id: pickingId },
      data: { state: 'done', doneAt: new Date() },
    });
  });

  await logAudit({
    action: 'validate', entity: 'picking', entityId: pickingId,
    userId: session.userId, companyId: session.companyId,
  });

  redirect(`/operations/${pickingId}`);
}

const TYPE_LABEL: Record<string, string> = {
  receipt: 'Réception',
  delivery: 'Expédition',
  internal: 'Transfert interne',
  manufacturing: 'Fabrication',
  return: 'Retour',
};

export default async function PickingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const picking = await prisma.picking.findUnique({
    where: { id },
    include: {
      partner: true,
      fromWarehouse: true,
      toWarehouse: true,
      lines: {
        include: {
          product: true,
          fromLocation: true,
          toLocation: true,
        },
      },
    },
  });
  if (!picking) notFound();

  const products = await prisma.product.findMany({
    where: { companyId: picking.companyId, deletedAt: null, type: { not: 'service' } },
    orderBy: { name: 'asc' },
  });

  // Locations selon type
  const locations = await prisma.location.findMany({
    where: {
      OR: [
        ...(picking.fromWarehouseId ? [{ warehouseId: picking.fromWarehouseId }] : []),
        ...(picking.toWarehouseId ? [{ warehouseId: picking.toWarehouseId }] : []),
        { type: { in: ['supplier', 'customer', 'transit', 'inventory', 'production'] } },
      ],
    },
    orderBy: { fullPath: 'asc' },
  });

  const editable = picking.state !== 'done' && picking.state !== 'cancelled';

  return (
    <div>
      <PageHeader
        title={`${TYPE_LABEL[picking.type] ?? picking.type} ${picking.reference}`}
        subtitle={picking.partner ? `Partenaire : ${picking.partner.name}` : undefined}
        module="M3"
        actions={
          <>
            <Link href="/operations" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>
            <button className="btn-secondary" type="button"><Printer className="size-4" /> Imprimer</button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <StatusBadge value={picking.state} />
        <span className="text-sm text-zinc-500">
          {picking.fromWarehouse?.name ?? '—'} → {picking.toWarehouse?.name ?? '—'}
        </span>
        <span className="text-sm text-zinc-500">Prévu : {formatDate(picking.scheduledAt)}</span>
        {picking.doneAt && <span className="text-sm text-zinc-500">Terminé : {formatDate(picking.doneAt)}</span>}
      </div>

      <div className="card mb-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Produit</th>
              <th>De</th>
              <th>Vers</th>
              <th>Lot / N° série</th>
              <th className="text-right">Demandé</th>
              <th className="text-right">Réalisé</th>
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {picking.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-mono text-xs">{l.product.sku}</div>
                  <div className="text-sm">{l.product.name}</div>
                </td>
                <td className="text-xs">{l.fromLocation?.fullPath ?? '—'}</td>
                <td className="text-xs">{l.toLocation?.fullPath ?? '—'}</td>
                <td className="text-xs font-mono">{l.lotName ?? '—'}</td>
                <td className="text-right tabular-nums">{formatNumber(l.qtyDemand, 0)}</td>
                <td className="text-right tabular-nums font-medium">{formatNumber(l.qtyDone, 0)}</td>
                {editable && (
                  <td className="text-right">
                    <form action={removeLine}>
                      <input type="hidden" name="lineId" value={l.id} />
                      <input type="hidden" name="pickingId" value={picking.id} />
                      <button type="submit" className="btn-ghost p-1 text-red-600">
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {picking.lines.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">Aucune ligne. Ajoutez des produits ci-dessous.</div>
        )}
      </div>

      {editable && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="size-4" /> Ajouter une ligne</h3>
          <form action={addLine} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <input type="hidden" name="pickingId" value={picking.id} />
            <div className="md:col-span-2">
              <label className="label">Produit *</label>
              <select name="productId" required className="input">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantité *</label>
              <input type="number" step="0.01" min="0" name="qty" required className="input" />
            </div>
            <div>
              <label className="label">De</label>
              <select name="fromLocationId" className="input">
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullPath}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Vers</label>
              <select name="toLocationId" className="input">
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullPath}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lot / N° série</label>
              <input name="lotName" className="input" placeholder="Optionnel" />
            </div>
            <div className="md:col-span-6">
              <button type="submit" className="btn-primary">Ajouter</button>
            </div>
          </form>
        </div>
      )}

      {editable && picking.lines.length > 0 && (
        <div className="flex items-center gap-3">
          {picking.state === 'draft' && (
            <form action={confirmPicking}>
              <input type="hidden" name="pickingId" value={picking.id} />
              <button type="submit" className="btn-secondary">Confirmer</button>
            </form>
          )}
          <form action={validatePicking}>
            <input type="hidden" name="pickingId" value={picking.id} />
            <button type="submit" className="btn-primary"><Check className="size-4" /> Valider et appliquer le mouvement</button>
          </form>
          <form action={cancelPicking}>
            <input type="hidden" name="pickingId" value={picking.id} />
            <button type="submit" className="btn-ghost text-red-600"><X className="size-4" /> Annuler</button>
          </form>
        </div>
      )}

      {picking.notes && (
        <div className="card p-4 mt-4">
          <h3 className="font-semibold text-sm mb-2">Notes</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{picking.notes}</p>
        </div>
      )}
    </div>
  );
}
