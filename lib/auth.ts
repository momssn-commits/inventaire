import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'inventaire-dev-secret-change-in-production-please'
);
const COOKIE_NAME = 'inv_session';

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(session: Session): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  // `secure: true` exigerait HTTPS — en HTTP le navigateur refuse d'envoyer
  // le cookie aux requêtes suivantes, l'utilisateur est éjecté à chaque clic.
  // On opt-in via la variable d'env COOKIE_SECURE quand l'app est derrière un
  // reverse-proxy HTTPS.
  const secure = process.env.COOKIE_SECURE === 'true';
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function requireRole(roles: string[]): Promise<Session> {
  const s = await requireSession();
  if (!roles.includes(s.role) && s.role !== 'admin') {
    redirect('/');
  }
  return s;
}

export async function logAudit(params: {
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string;
  companyId: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        userId: params.userId,
        companyId: params.companyId,
      },
    });
  } catch {
    // Ne jamais faire échouer l'opération métier sur une erreur d'audit
  }
}
