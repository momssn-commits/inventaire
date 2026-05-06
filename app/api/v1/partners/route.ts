import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiList, apiOk, apiError, authorize, parsePagination, parseJsonBody } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, perPage } = parsePagination(sp);
  const where: any = { companyId: auth.session.companyId, deletedAt: null };
  if (sp.get('type')) where.type = sp.get('type');
  if (sp.get('q')) where.name = { contains: sp.get('q')! };

  const [items, total] = await Promise.all([
    prisma.partner.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.partner.count({ where }),
  ]);
  return apiList(items, { total, page, perPage });
}

type Body = { name: string; type?: string; code?: string; email?: string; phone?: string; city?: string };

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body || !body.name) return apiError('validation_error', 'name requis.', 422);
  const created = await prisma.partner.create({
    data: {
      name: body.name,
      code: body.code ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      city: body.city ?? null,
      type: body.type ?? 'supplier',
      companyId: auth.session.companyId,
    },
  });
  return apiOk(created, { status: 201 });
}
