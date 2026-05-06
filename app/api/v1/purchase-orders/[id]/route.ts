import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize } from '@/lib/api';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId: auth.session.companyId },
    include: {
      partner: true,
      lines: { include: { product: { select: { sku: true, name: true } } } },
    },
  });
  if (!po) return apiError('not_found', 'Bon de commande introuvable.', 404);
  return apiOk(po);
}
