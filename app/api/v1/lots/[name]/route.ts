import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize } from '@/lib/api';

/**
 * Recherche d'un lot par nom (= code-barres / numéro de série).
 * Retourne aussi son historique de mouvements et sa position actuelle (traçabilité).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);

  const lot = await prisma.lot.findFirst({
    where: {
      name: decoded,
      product: { companyId: auth.session.companyId },
    },
    include: { product: true },
  });
  if (!lot) return apiError('not_found', `Lot « ${decoded} » introuvable.`, 404);

  const [stockLines, movements] = await Promise.all([
    prisma.stockLine.findMany({
      where: { lotId: lot.id },
      include: { location: { include: { warehouse: true } } },
    }),
    prisma.pickingLine.findMany({
      where: { lotName: lot.name, productId: lot.productId },
      include: {
        picking: { include: { partner: true } },
        fromLocation: true,
        toLocation: true,
      },
      orderBy: { picking: { doneAt: 'desc' } },
    }),
  ]);

  return apiOk({
    lot,
    currentStock: stockLines,
    movements,
    traceability: {
      ascending: movements.filter((m) => m.picking.type === 'receipt' || m.picking.type === 'manufacturing'),
      descending: movements.filter((m) => m.picking.type === 'delivery' || m.picking.type === 'internal'),
    },
  });
}
