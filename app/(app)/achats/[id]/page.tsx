import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Send, Truck, Check } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

async function recalcTotal(poId: string) {
  const lines = await prisma.purchaseOrderLine.findMany({ where: { poId } });
  const total = lines.reduce((s, l) => s + l.totalHt, 0);
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { totalHt: total } });
}

async function addPOLine(formData: FormData) {
  'use server';
  await requireSession();
  const poId = String(formData.get('poId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const qty = Number(formData.get('qty') ?? 0);
  const unitPrice = Number(formData.get('unitPrice') ?? 0);
  if (!poId || !productId || qty <= 0) redirect(`/achats/${poId}`);
  await prisma.purchaseOrderLine.create({
    data: { poId, productId, qty, unitPrice, totalHt: qty * unitPrice },
  });
  await recalcTotal(poId);
  redirect(`/achats/${poId}`);
}

async function removePOLine(formData: FormData) {
  'use server';
  await requireSession();
  const lineId = String(formData.get('lineId') ?? '');
  const poId = String(formData.get('poId') ?? '');
  await prisma.purchaseOrderLine.delete({ where: { id: lineId } });
  await recalcTotal(poId);
  redirect(`/achats/${poId}`);
}

async function sendPO(formData: FormData) {
  'use server';
  await requireSession();
  const poId = String(formData.get('poId') ?? '');
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { state: 'sent', orderedAt: new Date() },
  });
  redirect(`/achats/${poId}`);
}

async function confirmPO(formData: FormData) {
  'use server';
  await requireSession();
  const poId = String(formData.get('poId') ?? '');
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { state: 'confirmed' },
  });
  redirect(`/achats/${poId}`);
}

async function generateReceipt(formData: FormData) {
  'use server';
  const session = await requireSession();
  const poId = String(formData.get('poId') ?? '');
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { lines: { include: { product: true } }, partner: true },
  });
  if (!po) redirect('/achats?error=notfound');

  const wh = await prisma.warehouse.findFirst({
    where: { companyId: session.companyId, deletedAt: null },
  });
  const supplierLoc = await prisma.location.findFirst({ where: { type: 'supplier' } });
  const wh1Reception = await prisma.location.findFirst({
    where: { warehouseId: wh?.id, type: 'internal', name: { contains: 'réception' } },
  });

  const ref = await nextSequence('PICKING_RECEIPT', 'WH/IN/', 5);
  const picking = await prisma.picking.create({
    data: {
      reference: ref,
      type: 'receipt',
      state: 'confirmed',
      origin: po.reference,
      partnerId: po.partnerId,
      fromWarehouseId: wh?.id,
      toWarehouseId: wh?.id,
      scheduledAt: po.expectedAt ?? new Date(),
      companyId: session.companyId,
      lines: {
        create: po.lines.map((l) => ({
          productId: l.productId,
          qtyDemand: l.qty,
          qtyDone: 0,
          fromLocationId: supplierLoc?.id,
          toLocationId: wh1Reception?.id ?? null,
        })),
      },
    },
  });

  await logAudit({
    action: 'create', entity: 'picking', entityId: picking.id,
    newValue: { from: po.reference }, userId: session.userId, companyId: session.companyId,
  });

  redirect(`/operations/${picking.id}`);
}

export default async function POPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      partner: true,
      lines: { include: { product: true } },
    },
  });
  if (!po) notFound();

  const products = await prisma.product.findMany({
    where: { companyId: po.companyId, deletedAt: null, type: { not: 'service' } },
    orderBy: { name: 'asc' },
  });

  const editable = po.state === 'draft' || po.state === 'sent';

  return (
    <div>
      <PageHeader
        title={`Bon de commande ${po.reference}`}
        subtitle={`Fournisseur : ${po.partner.name}`}
        module="M7"
        actions={<Link href="/achats" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      <div className="flex items-center gap-3 mb-4">
        <StatusBadge value={po.state} />
        <span className="text-sm text-zinc-500">Commandé : {formatDate(po.orderedAt)}</span>
        <span className="text-sm text-zinc-500">Réception prévue : {formatDate(po.expectedAt)}</span>
        <span className="ml-auto text-lg font-semibold tabular-nums">{formatMoney(po.totalHt)}</span>
      </div>

      <div className="card mb-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Produit</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">Prix unit.</th>
              <th className="text-right">Total HT</th>
              <th className="text-right">Reçu</th>
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-mono text-xs">{l.product.sku}</div>
                  <div className="text-sm">{l.product.name}</div>
                </td>
                <td className="text-right tabular-nums">{formatNumber(l.qty, 0)}</td>
                <td className="text-right tabular-nums text-sm">{formatMoney(l.unitPrice)}</td>
                <td className="text-right tabular-nums font-medium">{formatMoney(l.totalHt)}</td>
                <td className="text-right tabular-nums text-zinc-500">{formatNumber(l.qtyReceived, 0)}</td>
                {editable && (
                  <td className="text-right">
                    <form action={removePOLine}>
                      <input type="hidden" name="lineId" value={l.id} />
                      <input type="hidden" name="poId" value={po.id} />
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
        {po.lines.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">Aucune ligne. Ajoutez des produits ci-dessous.</div>
        )}
      </div>

      {editable && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="size-4" /> Ajouter une ligne</h3>
          <form action={addPOLine} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <input type="hidden" name="poId" value={po.id} />
            <div className="md:col-span-2">
              <label className="label">Produit *</label>
              <select name="productId" required className="input">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} data-cost={p.cost}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantité *</label>
              <input type="number" step="0.01" min="0" name="qty" required className="input" />
            </div>
            <div>
              <label className="label">Prix unitaire HT (FCFA) *</label>
              <input type="number" step="100" min="0" name="unitPrice" required className="input" />
            </div>
            <div>
              <button type="submit" className="btn-primary w-full">Ajouter</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {po.state === 'draft' && po.lines.length > 0 && (
          <form action={sendPO}>
            <input type="hidden" name="poId" value={po.id} />
            <button type="submit" className="btn-secondary"><Send className="size-4" /> Envoyer au fournisseur</button>
          </form>
        )}
        {po.state === 'sent' && (
          <form action={confirmPO}>
            <input type="hidden" name="poId" value={po.id} />
            <button type="submit" className="btn-secondary"><Check className="size-4" /> Confirmer la commande</button>
          </form>
        )}
        {(po.state === 'confirmed' || po.state === 'sent') && po.lines.length > 0 && (
          <form action={generateReceipt}>
            <input type="hidden" name="poId" value={po.id} />
            <button type="submit" className="btn-primary"><Truck className="size-4" /> Générer la réception</button>
          </form>
        )}
      </div>
    </div>
  );
}
