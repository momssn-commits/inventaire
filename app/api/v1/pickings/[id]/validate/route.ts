import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize } from '@/lib/api';
import { applyMovement } from '@/lib/stock';
import { logAudit } from '@/lib/auth';

/**
 * Valide un mouvement : applique le stock atomiquement.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;

  const picking = await prisma.picking.findFirst({
    where: { id, companyId: auth.session.companyId },
    include: { lines: { include: { product: true } } },
  });
  if (!picking) return apiError('not_found', 'Mouvement introuvable.', 404);
  if (picking.state === 'done') return apiError('conflict', 'Mouvement déjà validé.', 409);
  if (picking.state === 'cancelled') return apiError('conflict', 'Mouvement annulé.', 409);

  const supplierLoc = await prisma.location.findFirst({ where: { type: 'supplier' } });
  const customerLoc = await prisma.location.findFirst({ where: { type: 'customer' } });

  await prisma.$transaction(async (tx) => {
    for (const line of picking.lines) {
      let fromId = line.fromLocationId;
      let toId = line.toLocationId;
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

      await tx.pickingLine.update({
        where: { id: line.id },
        data: { lotId, qtyDone: qty },
      });
    }
    await tx.picking.update({
      where: { id: picking.id },
      data: { state: 'done', doneAt: new Date() },
    });
  });

  await logAudit({
    action: 'validate', entity: 'picking', entityId: picking.id,
    userId: auth.session.userId, companyId: auth.session.companyId,
  });

  const updated = await prisma.picking.findUnique({
    where: { id: picking.id },
    include: { lines: true },
  });
  return apiOk(updated);
}
