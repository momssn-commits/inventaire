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

/**
 * Classification ABC (Pareto) par valeur cumulée :
 *   A = top 80% de la valeur
 *   B = 80% - 95%
 *   C = 95% - 100%
 */
export async function getAbcClassification(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, type: 'storable' },
    include: { stockLines: { where: { location: { type: 'internal' } } } },
  });
  const ranked = products
    .map((p) => {
      const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
      const value = p.stockLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
      return { product: p, qty, value };
    })
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.value - a.value);
  const total = ranked.reduce((s, r) => s + r.value, 0);
  let cumul = 0;
  return ranked.map((r) => {
    cumul += r.value;
    const pct = total > 0 ? (cumul / total) * 100 : 0;
    const klass = pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C';
    return { ...r, share: total > 0 ? (r.value / total) * 100 : 0, cumulShare: pct, abc: klass };
  });
}

/**
 * Détection des alertes stock : rupture, sous-seuil, sur-stock, vieillissement.
 */
export async function getStockAlerts(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, type: 'storable' },
    include: { stockLines: { where: { location: { type: 'internal' } } } },
  });
  const ruptures: typeof products = [];
  const sousSeuil: typeof products = [];
  const surStock: typeof products = [];

  for (const p of products) {
    const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
    if (qty <= 0) ruptures.push(p);
    else if (p.minQty > 0 && qty < p.minQty) sousSeuil.push(p);
    if (p.maxQty > 0 && qty > p.maxQty * 1.2) surStock.push(p);
  }

  // Vieillissement : lignes de stock qui n'ont pas bougé depuis > 365 j
  const now = Date.now();
  const oneYearMs = 365 * 86400 * 1000;
  const oldStock = await prisma.stockLine.findMany({
    where: {
      product: { companyId },
      location: { type: 'internal' },
      quantity: { gt: 0 },
      updatedAt: { lt: new Date(now - oneYearMs) },
    },
    include: { product: true, location: true, lot: true },
    take: 50,
    orderBy: { updatedAt: 'asc' },
  });

  return { ruptures, sousSeuil, surStock, oldStock };
}

/**
 * Transfert rapide entre deux emplacements (atomique).
 */
export async function transferStock(params: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  lotId?: string | null;
}) {
  const { productId, fromLocationId, toLocationId, qty, lotId = null } = params;
  if (qty <= 0) throw new Error('La quantité doit être positive.');
  if (fromLocationId === toLocationId) throw new Error('Source et destination identiques.');

  return prisma.$transaction(async (tx) => {
    const src = await tx.stockLine.findFirst({
      where: { productId, locationId: fromLocationId, lotId },
    });
    if (!src || src.quantity < qty) {
      throw new Error(`Stock insuffisant à la source (disponible : ${src?.quantity ?? 0}).`);
    }
    await applyMovement(tx, {
      productId,
      fromLocationId,
      toLocationId,
      qty,
      lotId,
      unitCost: src.unitCost,
    });
    return { ok: true, qty, unitCost: src.unitCost };
  });
}
