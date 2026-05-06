import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize, parseJsonBody } from '@/lib/api';
import { transferStock } from '@/lib/stock';
import { nextSequence } from '@/lib/sequence';
import { logAudit } from '@/lib/auth';

type Body = {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  lotId?: string | null;
  notes?: string;
};

/**
 * POST /api/v1/stock/transfer
 * Transfert atomique entre deux emplacements + création d'un Picking interne tracé.
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);
  if (!body.productId || !body.fromLocationId || !body.toLocationId || !body.qty || body.qty <= 0) {
    return apiError(
      'validation_error',
      'productId, fromLocationId, toLocationId et qty (>0) sont obligatoires.',
      422
    );
  }

  // Vérifier que le produit appartient à la société
  const product = await prisma.product.findFirst({
    where: { id: body.productId, companyId: auth.session.companyId, deletedAt: null },
  });
  if (!product) return apiError('not_found', 'Produit introuvable.', 404);

  try {
    const result = await transferStock({
      productId: body.productId,
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      qty: body.qty,
      lotId: body.lotId ?? null,
    });

    const reference = await nextSequence('PICKING_INTERNAL', 'WH/INT/', 5);
    const lot = body.lotId ? await prisma.lot.findUnique({ where: { id: body.lotId } }) : null;

    const picking = await prisma.picking.create({
      data: {
        reference,
        type: 'internal',
        state: 'done',
        scheduledAt: new Date(),
        doneAt: new Date(),
        notes: body.notes ?? null,
        companyId: auth.session.companyId,
        lines: {
          create: [{
            productId: body.productId,
            qtyDemand: body.qty,
            qtyDone: body.qty,
            fromLocationId: body.fromLocationId,
            toLocationId: body.toLocationId,
            lotId: body.lotId ?? null,
            lotName: lot?.name,
          }],
        },
      },
      include: { lines: true },
    });

    await logAudit({
      action: 'transfer', entity: 'picking', entityId: picking.id,
      newValue: { qty: body.qty, productId: body.productId, from: body.fromLocationId, to: body.toLocationId },
      userId: auth.session.userId, companyId: auth.session.companyId,
    });

    return apiOk({
      reference: picking.reference,
      pickingId: picking.id,
      qty: result.qty,
      unitCost: result.unitCost,
    }, { status: 201 });
  } catch (e: any) {
    return apiError('transfer_failed', e.message ?? 'Échec du transfert', 422);
  }
}
