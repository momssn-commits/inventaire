import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, authorize } from '@/lib/api';

/**
 * Statistiques globales pour le tableau de bord — un seul endpoint pour tout récupérer.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const where = { companyId: auth.session.companyId };

  const [
    products, warehouses, partners,
    pickingsOpen, pickingsDone,
    qualityOpen,
    mosOpen,
    lots,
    stockAggregate,
  ] = await Promise.all([
    prisma.product.count({ where: { ...where, deletedAt: null } }),
    prisma.warehouse.count({ where: { ...where, deletedAt: null } }),
    prisma.partner.count({ where: { ...where, deletedAt: null } }),
    prisma.picking.count({ where: { ...where, state: { in: ['draft', 'confirmed', 'assigned'] } } }),
    prisma.picking.count({ where: { ...where, state: 'done' } }),
    prisma.qualityAlert.count({ where: { ...where, state: { not: 'resolved' } } }),
    prisma.manufacturingOrder.count({ where: { ...where, state: { in: ['draft', 'confirmed', 'in_progress'] } } }),
    prisma.lot.count({ where: { product: { companyId: auth.session.companyId } } }),
    prisma.stockLine.aggregate({
      where: { location: { type: 'internal' }, product: { companyId: auth.session.companyId } },
      _sum: { quantity: true },
    }),
  ]);

  // Valeur totale du stock
  const stockLines = await prisma.stockLine.findMany({
    where: { location: { type: 'internal' }, product: { companyId: auth.session.companyId } },
    select: { quantity: true, unitCost: true },
  });
  const stockValue = stockLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  return apiOk({
    counters: {
      products,
      warehouses,
      partners,
      lots,
      pickingsOpen,
      pickingsDone,
      qualityOpen,
      mosOpen,
    },
    stock: {
      units: stockAggregate._sum.quantity ?? 0,
      value: stockValue,
    },
  });
}
