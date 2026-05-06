import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, apiOk, apiError, authorize, parsePagination, parseJsonBody } from '@/lib/api';
import { nextSequence } from '@/lib/sequence';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = { companyId: auth.session.companyId };
  if (sp.get('state')) where.state = sp.get('state');
  if (sp.get('partner_id')) where.partnerId = sp.get('partner_id');

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
      include: { partner: true, _count: { select: { lines: true } } },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type Body = {
  partnerId: string;
  expectedAt?: string;
  notes?: string;
  lines?: { productId: string; qty: number; unitPrice: number }[];
};

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body || !body.partnerId) return apiError('validation_error', 'partnerId requis.', 422);

  const reference = await nextSequence('PO', 'PO', 5);
  const lines = body.lines ?? [];
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      reference,
      state: 'draft',
      partnerId: body.partnerId,
      expectedAt: body.expectedAt ? new Date(body.expectedAt) : null,
      notes: body.notes ?? null,
      totalHt: total,
      companyId: auth.session.companyId,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          totalHt: l.qty * l.unitPrice,
        })),
      },
    },
    include: { lines: true, partner: true },
  });
  return apiOk(po, { status: 201 });
}
