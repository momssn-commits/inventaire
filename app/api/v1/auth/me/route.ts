import { NextRequest } from 'next/server';
import { apiOk, authorize } from '@/lib/api';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    select: {
      id: true, email: true, name: true, role: true, companyId: true,
      twoFactor: true, lastLoginAt: true, createdAt: true,
      company: { select: { id: true, code: true, name: true, currency: true, locale: true } },
    },
  });
  return apiOk(user);
}
