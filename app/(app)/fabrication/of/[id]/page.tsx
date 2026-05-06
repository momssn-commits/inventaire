import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Play, Check } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { applyMovement } from '@/lib/stock';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

async function startMO(formData: FormData) {
  'use server';
  await requireSession();
  const moId = String(formData.get('moId') ?? '');
  await prisma.manufacturingOrder.update({
    where: { id: moId },
    data: { state: 'in_progress', startedAt: new Date() },
  });
  redirect(`/fabrication/of/${moId}`);
}

async function completeMO(formData: FormData) {
  'use server';
  const session = await requireSession();
  const moId = String(formData.get('moId') ?? '');
  const mo = await prisma.manufacturingOrder.findUnique({
    where: { id: moId },
    include: { product: true },
  });
  if (!mo) redirect('/fabrication?error=notfound');

  const bom = await prisma.bom.findFirst({
    where: { productId: mo.productId, active: true },
    include: { components: { include: { product: true } } },
  });
  if (!bom) redirect(`/fabrication/of/${moId}?error=nobom`);

  const wh = await prisma.warehouse.findFirst({
    where: { companyId: session.companyId, deletedAt: null },
  });
  const stockLoc = await prisma.location.findFirst({
    where: { warehouseId: wh?.id, type: 'view', name: 'Stock' },
  });
  let prodLoc = await prisma.location.findFirst({
    where: { warehouseId: wh?.id, type: 'production' },
  });
  if (!prodLoc && wh) {
    prodLoc = await prisma.location.create({
      data: { name: 'Production', fullPath: `${wh.code}/Production`, type: 'production', warehouseId: wh.id },
    });
  }
  // Trouve le premier emplacement interne pour stocker le produit fini
  const finishLoc = await prisma.location.findFirst({
    where: { warehouseId: wh?.id, type: 'internal' },
  });

  await prisma.$transaction(async (tx) => {
    // Consommer les composants
    for (const comp of bom.components) {
      const need = comp.qty * mo.qtyToProduce;
      const sourceLines = await tx.stockLine.findMany({
        where: {
          productId: comp.productId,
          location: { type: 'internal' },
          quantity: { gt: 0 },
        },
        orderBy: { id: 'asc' },
      });
      let remaining = need;
      for (const sl of sourceLines) {
        if (remaining <= 0) break;
        const take = Math.min(sl.quantity, remaining);
        await applyMovement(tx, {
          productId: comp.productId,
          fromLocationId: sl.locationId,
          toLocationId: prodLoc?.id ?? null,
          qty: take,
          lotId: sl.lotId,
          unitCost: sl.unitCost,
        });
        remaining -= take;
      }
      // Si stock insuffisant, on consomme tout de même depuis production (négatif autorisé)
      if (remaining > 0 && prodLoc) {
        await applyMovement(tx, {
          productId: comp.productId,
          fromLocationId: prodLoc.id,
          toLocationId: null,
          qty: remaining,
          unitCost: comp.product.cost,
        });
      }
    }

    // Produire le produit fini
    if (finishLoc) {
      // Calcul du coût de production = somme des composants + coût opérations
      const operations = await tx.bomOperation.findMany({
        where: { bomId: bom.id },
        include: { workCenter: true },
      });
      const opCost = operations.reduce(
        (s, o) => s + (o.durationMin / 60) * o.workCenter.costHourly,
        0
      );
      const compCost = bom.components.reduce((s, c) => s + c.qty * c.product.cost, 0);
      const unitCost = (compCost + opCost) / Math.max(bom.qtyOutput, 1);

      await applyMovement(tx, {
        productId: mo.productId,
        fromLocationId: prodLoc?.id ?? null,
        toLocationId: finishLoc.id,
        qty: mo.qtyToProduce,
        unitCost,
      });
    }

    // Marquer les WO comme done
    await tx.workOrder.updateMany({
      where: { moId: mo.id },
      data: { state: 'done', doneAt: new Date() },
    });

    await tx.manufacturingOrder.update({
      where: { id: mo.id },
      data: {
        state: 'done',
        qtyProduced: mo.qtyToProduce,
        doneAt: new Date(),
      },
    });
  });

  await logAudit({
    action: 'complete', entity: 'manufacturingOrder', entityId: moId,
    userId: session.userId, companyId: session.companyId,
  });

  redirect(`/fabrication/of/${moId}`);
}

export default async function MOPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const mo = await prisma.manufacturingOrder.findUnique({
    where: { id },
    include: {
      product: true,
      workOrders: { include: { workCenter: true }, orderBy: { id: 'asc' } },
    },
  });
  if (!mo) notFound();

  const bom = await prisma.bom.findFirst({
    where: { productId: mo.productId, active: true },
    include: { components: { include: { product: true } }, operations: true },
  });

  return (
    <div>
      <PageHeader
        title={`Ordre de fabrication ${mo.reference}`}
        subtitle={`Produit : ${mo.product.name} • Quantité : ${formatNumber(mo.qtyToProduce, 0)}`}
        module="M8"
        actions={<Link href="/fabrication" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      <div className="flex items-center gap-3 mb-4">
        <StatusBadge value={mo.state} />
        {mo.startedAt && <span className="text-sm text-zinc-500">Démarré : {formatDate(mo.startedAt)}</span>}
        {mo.doneAt && <span className="text-sm text-zinc-500">Terminé : {formatDate(mo.doneAt)}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Composants nécessaires</h3>
          {bom ? (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Composant</th>
                  <th className="text-right">Unitaire</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.components.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs">{c.product.sku}</td>
                    <td className="text-sm">{c.product.name}</td>
                    <td className="text-right tabular-nums">{formatNumber(c.qty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatNumber(c.qty * mo.qtyToProduce, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-amber-600">Aucune nomenclature active pour ce produit.</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Ordres de travail</h3>
          {mo.workOrders.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucun ordre de travail.</p>
          ) : (
            <ul className="space-y-2">
              {mo.workOrders.map((wo) => (
                <li key={wo.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{wo.name}</div>
                    <div className="text-xs text-zinc-500">{wo.workCenter.name} • {formatNumber(wo.durationMin, 0)} min</div>
                  </div>
                  <StatusBadge value={wo.state} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {mo.state === 'confirmed' && (
          <form action={startMO}>
            <input type="hidden" name="moId" value={mo.id} />
            <button type="submit" className="btn-secondary"><Play className="size-4" /> Démarrer</button>
          </form>
        )}
        {(mo.state === 'in_progress' || mo.state === 'confirmed') && (
          <form action={completeMO}>
            <input type="hidden" name="moId" value={mo.id} />
            <button type="submit" className="btn-primary">
              <Check className="size-4" /> Terminer et consommer / produire
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
