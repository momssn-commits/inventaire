import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, apiOk, apiError, authorize, parsePagination, parseJsonBody } from '@/lib/api';
import { logAudit } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = { companyId: auth.session.companyId, deletedAt: null };
  if (sp.get('q')) {
    const q = sp.get('q')!;
    where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
  }
  const [items, total] = await Promise.all([
    prisma.warehouse.findMany({
      where, skip, take, orderBy: { code: 'asc' },
      include: { _count: { select: { locations: true } } },
    }),
    prisma.warehouse.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type CreateBody = {
  code: string; name: string;
  address?: string; city?: string; zip?: string; country?: string;
  managerName?: string;
  receptionSteps?: number; deliverySteps?: number;
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<CreateBody>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);
  if (!body.code || !body.name) return apiError('validation_error', 'code et name requis.', 422);

  try {
    const wh = await prisma.warehouse.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        address: body.address ?? null,
        city: body.city ?? null,
        zip: body.zip ?? null,
        country: body.country ?? 'FR',
        managerName: body.managerName ?? null,
        receptionSteps: body.receptionSteps ?? 1,
        deliverySteps: body.deliverySteps ?? 1,
        companyId: auth.session.companyId,
      },
    });
    // Création des emplacements par défaut
    await prisma.location.createMany({
      data: [
        { name: 'Stock', fullPath: `${wh.code}/Stock`, type: 'view', warehouseId: wh.id },
        { name: 'Quai réception', fullPath: `${wh.code}/Réception`, type: 'internal', warehouseId: wh.id },
        { name: 'Quai expédition', fullPath: `${wh.code}/Expédition`, type: 'internal', warehouseId: wh.id },
        { name: 'Rebut', fullPath: `${wh.code}/Rebut`, type: 'scrap', warehouseId: wh.id },
      ],
    });
    await logAudit({
      action: 'create', entity: 'warehouse', entityId: wh.id,
      newValue: { code: wh.code, name: wh.name },
      userId: auth.session.userId, companyId: auth.session.companyId,
    });
    return apiOk(wh, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return apiError('conflict', 'Code d\'entrepôt déjà utilisé.', 409);
    return apiError('server_error', e.message, 500);
  }
}
