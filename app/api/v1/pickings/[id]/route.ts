import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize } from '@/lib/api';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const picking = await prisma.picking.findFirst({
    where: { id, companyId: auth.session.companyId },
    include: {
      partner: true,
      fromWarehouse: true,
      toWarehouse: true,
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
          fromLocation: true,
          toLocation: true,
        },
      },
    },
  });
  if (!picking) return apiError('not_found', 'Mouvement introuvable.', 404);
  return apiOk(picking);
}
