import { PrismaClient } from '@prisma/client';
import { prisma } from './db';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Applique un mouvement de stock atomique : décrémente la source, incrémente la destination.
 * Met à jour les coûts (moyenne pondérée à l'entrée).
 */
export async function applyMovement(
  tx: Tx,
  params: {
    productId: string;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    qty: number;
    lotId?: string | null;
    unitCost?: number;
  }
) {
  const { productId, fromLocationId, toLocationId, qty, lotId = null, unitCost } = params;
  if (qty <= 0) return;

  if (fromLocationId) {
    const src = await tx.stockLine.findFirst({
      where: { productId, locationId: fromLocationId, lotId },
    });
    if (src) {
      await tx.stockLine.update({
        where: { id: src.id },
        data: { quantity: src.quantity - qty },
      });
    } else {
      await tx.stockLine.create({
        data: {
          productId,
          locationId: fromLocationId,
          lotId,
          quantity: -qty,
          unitCost: unitCost ?? 0,
        },
      });
    }
  }

  if (toLocationId) {
    const dst = await tx.stockLine.findFirst({
      where: { productId, locationId: toLocationId, lotId },
    });
    if (dst) {
      const totalQty = dst.quantity + qty;
      const newCost =
        totalQty > 0
          ? (dst.quantity * dst.unitCost + qty * (unitCost ?? dst.unitCost)) / totalQty
          : (unitCost ?? dst.unitCost);
      await tx.stockLine.update({
        where: { id: dst.id },
        data: { quantity: totalQty, unitCost: newCost },
      });
    } else {
      await tx.stockLine.create({
        data: {
          productId,
          locationId: toLocationId,
          lotId,
          quantity: qty,
          unitCost: unitCost ?? 0,
        },
      });
    }
  }
}

/**
 * Stock total disponible (toutes lignes positives) d'un produit.
 */
export async function getOnHand(productId: string): Promise<number> {
  const result = await prisma.stockLine.aggregate({
    where: {
      productId,
      location: { type: 'internal' },
    },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function getStockByProduct() {
  const lines = await prisma.stockLine.findMany({
    where: { location: { type: 'internal' } },
    include: { product: true, location: true, lot: true },
  });
  const map = new Map<string, { product: typeof lines[number]['product']; qty: number; value: number }>();
  for (const l of lines) {
    const cur = map.get(l.productId) ?? { product: l.product, qty: 0, value: 0 };
    cur.qty += l.quantity;
    cur.value += l.quantity * l.unitCost;
    map.set(l.productId, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}
