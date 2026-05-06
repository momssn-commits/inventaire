import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize } from '@/lib/api';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const wh = await prisma.warehouse.findFirst({
    where: { id, companyId: auth.session.companyId, deletedAt: null },
    include: {
      locations: { orderBy: { fullPath: 'asc' } },
    },
  });
  if (!wh) return apiError('not_found', 'Entrepôt introuvable.', 404);
  return apiOk(wh);
}
