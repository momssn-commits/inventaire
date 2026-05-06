import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiList, apiOk, apiError, authorize, parsePagination, parseSort, parseJsonBody,
} from '@/lib/api';
import { logAudit } from '@/lib/auth';

const SORT_FIELDS = ['name', 'sku', 'cost', 'salePrice', 'createdAt', 'updatedAt'];

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { session } = auth;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const orderBy = parseSort(sp, SORT_FIELDS);

  const where: any = { companyId: session.companyId, deletedAt: null };
  const q = sp.get('q');
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { sku: { contains: q } },
      { barcode: { contains: q } },
    ];
  }
  if (sp.get('type')) where.type = sp.get('type');
  if (sp.get('tracking')) where.tracking = sp.get('tracking');
  if (sp.get('category_id')) where.categoryId = sp.get('category_id');
  if (sp.get('active') === 'true') where.active = true;
  if (sp.get('active') === 'false') where.active = false;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderBy.length > 0 ? orderBy : [{ name: 'asc' }],
      skip,
      take,
      include: { category: true, uomStock: true },
    }),
    prisma.product.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type CreateBody = {
  sku: string;
  name: string;
  type?: string;
  tracking?: string;
  barcode?: string | null;
  description?: string | null;
  salePrice?: number;
  cost?: number;
  categoryId?: string | null;
  uomStockId?: string;
  minQty?: number;
  maxQty?: number;
  reorderQty?: number;
  leadTimeDays?: number;
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<CreateBody>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);
  if (!body.sku || !body.name) return apiError('validation_error', 'sku et name sont obligatoires.', 422);

  let uomStockId = body.uomStockId;
  if (!uomStockId) {
    const def = await prisma.uom.findFirst({ where: { symbol: 'u' } });
    if (!def) return apiError('uom_missing', 'Aucune unité par défaut.', 500);
    uomStockId = def.id;
  }

  try {
    const created = await prisma.product.create({
      data: {
        sku: body.sku,
        name: body.name,
        type: body.type ?? 'storable',
        tracking: body.tracking ?? 'none',
        barcode: body.barcode ?? null,
        description: body.description ?? null,
        salePrice: body.salePrice ?? 0,
        cost: body.cost ?? 0,
        categoryId: body.categoryId ?? null,
        minQty: body.minQty ?? 0,
        maxQty: body.maxQty ?? 0,
        reorderQty: body.reorderQty ?? 0,
        leadTimeDays: body.leadTimeDays ?? 0,
        companyId: auth.session.companyId,
        uomStockId,
      },
    });
    await logAudit({
      action: 'create', entity: 'product', entityId: created.id,
      newValue: { sku: created.sku, name: created.name },
      userId: auth.session.userId, companyId: auth.session.companyId,
    });
    return apiOk(created, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return apiError('conflict', 'SKU ou code-barres déjà utilisé.', 409);
    return apiError('server_error', e.message ?? 'Erreur inconnue', 500);
  }
}
