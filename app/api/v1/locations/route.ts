import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, apiOk, apiError, authorize, parsePagination, parseJsonBody } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = {};
  if (sp.get('warehouse_id')) where.warehouseId = sp.get('warehouse_id');
  if (sp.get('type')) where.type = sp.get('type');
  if (sp.get('q')) where.fullPath = { contains: sp.get('q')! };
  if (sp.get('barcode')) where.barcode = sp.get('barcode');

  const [items, total] = await Promise.all([
    prisma.location.findMany({
      where, skip, take,
      orderBy: { fullPath: 'asc' },
      include: { warehouse: true },
    }),
    prisma.location.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type CreateBody = {
  name: string; type?: string;
  warehouseId?: string; parentId?: string;
  barcode?: string;
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<CreateBody>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);
  if (!body.name) return apiError('validation_error', 'name requis.', 422);

  let fullPath = body.name;
  if (body.parentId) {
    const parent = await prisma.location.findUnique({ where: { id: body.parentId } });
    if (parent) fullPath = `${parent.fullPath}/${body.name}`;
  } else if (body.warehouseId) {
    const wh = await prisma.warehouse.findUnique({ where: { id: body.warehouseId } });
    if (wh) fullPath = `${wh.code}/${body.name}`;
  }
  const created = await prisma.location.create({
    data: {
      name: body.name,
      fullPath,
      type: body.type ?? 'internal',
      warehouseId: body.warehouseId ?? null,
      parentId: body.parentId ?? null,
      barcode: body.barcode ?? null,
    },
  });
  return apiOk(created, { status: 201 });
}
