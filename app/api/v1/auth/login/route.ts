import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  logAudit,
} from '@/lib/auth';
import { apiError, parseJsonBody } from '@/lib/api';

type LoginBody = { email?: string; password?: string };

export async function POST(req: NextRequest) {
  const body = await parseJsonBody<LoginBody>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !password) {
    return apiError('validation_error', 'Email et mot de passe requis.', 422);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return apiError('invalid_credentials', 'Identifiants invalides.', 401);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: { increment: 1 } },
    });
    return apiError('invalid_credentials', 'Identifiants invalides.', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedAttempts: 0 },
  });

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  });

  await setSessionCookie(token);
  await logAudit({
    action: 'login',
    entity: 'user',
    entityId: user.id,
    userId: user.id,
    companyId: user.companyId,
  });

  return NextResponse.json({
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn: 60 * 60 * 24 * 7,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    },
  });
}
