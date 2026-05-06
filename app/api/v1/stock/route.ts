import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, authorize, parsePagination } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = {
    product: { companyId: auth.session.companyId },
  };
  if (sp.get('product_id')) where.productId = sp.get('product_id');
  if (sp.get('location_id')) where.locationId = sp.get('location_id');
  if (sp.get('warehouse_id')) where.location = { warehouseId: sp.get('warehouse_id') };
  if (sp.get('only_internal') === 'true') {
    where.location = { ...(where.location ?? {}), type: 'internal' };
  }
  if (sp.get('only_positive') === 'true') where.quantity = { gt: 0 };

  const [items, total] = await Promise.all([
    prisma.stockLine.findMany({
      where, skip, take,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, fullPath: true, type: true, warehouse: { select: { code: true, name: true } } } },
        lot: { select: { id: true, name: true, condition: true, brand: true } },
      },
      orderBy: { quantity: 'desc' },
    }),
    prisma.stockLine.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}
