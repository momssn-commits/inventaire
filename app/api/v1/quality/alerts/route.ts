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
  if (sp.get('severity')) where.severity = sp.get('severity');

  const [items, total] = await Promise.all([
    prisma.qualityAlert.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.qualityAlert.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type Body = { title: string; description?: string; severity?: string; productId?: string; partnerId?: string };

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body || !body.title) return apiError('validation_error', 'title requis.', 422);
  const reference = await nextSequence('QA', 'QA', 5);
  const created = await prisma.qualityAlert.create({
    data: {
      reference,
      title: body.title,
      description: body.description ?? null,
      severity: body.severity ?? 'medium',
      productId: body.productId ?? null,
      partnerId: body.partnerId ?? null,
      companyId: auth.session.companyId,
    },
  });
  return apiOk(created, { status: 201 });
}
