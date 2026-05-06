import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, authorize, parsePagination } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = { product: { companyId: auth.session.companyId } };
  if (sp.get('q')) where.name = { contains: sp.get('q')! };
  if (sp.get('product_id')) where.productId = sp.get('product_id');
  if (sp.get('serial')) where.isSerial = sp.get('serial') === 'true';

  const [items, total] = await Promise.all([
    prisma.lot.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
      include: { product: true },
    }),
    prisma.lot.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}
