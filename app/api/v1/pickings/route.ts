import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, apiOk, apiError, authorize, parsePagination, parseJsonBody } from '@/lib/api';
import { nextSequence } from '@/lib/sequence';
import { logAudit } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = { companyId: auth.session.companyId };
  if (sp.get('type')) where.type = sp.get('type');
  if (sp.get('state')) where.state = sp.get('state');
  if (sp.get('partner_id')) where.partnerId = sp.get('partner_id');
  if (sp.get('q')) where.reference = { contains: sp.get('q')! };

  const [items, total] = await Promise.all([
    prisma.picking.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        partner: true,
        fromWarehouse: true,
        toWarehouse: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.picking.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type Body = {
  type: string;
  partnerId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  scheduledAt?: string;
  notes?: string;
  origin?: string;
  lines?: {
    productId: string;
    qty: number;
    fromLocationId?: string;
    toLocationId?: string;
    lotName?: string;
  }[];
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body || !body.type) return apiError('validation_error', 'type requis.', 422);

  const seqMap: Record<string, [string, string]> = {
    receipt: ['PICKING_RECEIPT', 'WH/IN/'],
    delivery: ['PICKING_DELIVERY', 'WH/OUT/'],
    internal: ['PICKING_INTERNAL', 'WH/INT/'],
    return: ['PICKING_INTERNAL', 'WH/RET/'],
    manufacturing: ['PICKING_INTERNAL', 'WH/MO/'],
  };
  const seq = seqMap[body.type] ?? ['PICKING_INTERNAL', 'WH/'];
  const reference = await nextSequence(seq[0], seq[1], 5);

  const picking = await prisma.picking.create({
    data: {
      reference,
      type: body.type,
      state: 'draft',
      partnerId: body.partnerId ?? null,
      fromWarehouseId: body.fromWarehouseId ?? null,
      toWarehouseId: body.toWarehouseId ?? null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
      notes: body.notes ?? null,
      origin: body.origin ?? null,
      companyId: auth.session.companyId,
      lines: body.lines && body.lines.length > 0
        ? {
            create: body.lines.map((l) => ({
              productId: l.productId,
              qtyDemand: l.qty,
              qtyDone: l.qty,
              fromLocationId: l.fromLocationId ?? null,
              toLocationId: l.toLocationId ?? null,
              lotName: l.lotName ?? null,
            })),
          }
        : undefined,
    },
  });

  await logAudit({
    action: 'create', entity: 'picking', entityId: picking.id,
    userId: auth.session.userId, companyId: auth.session.companyId,
  });

  return apiOk(picking, { status: 201 });
}
