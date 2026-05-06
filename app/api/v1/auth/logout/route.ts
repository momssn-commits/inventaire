import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/api';
import { clearSessionCookie, logAudit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  await clearSessionCookie();
  await logAudit({
    action: 'logout',
    entity: 'user',
    entityId: auth.session.userId,
    userId: auth.session.userId,
    companyId: auth.session.companyId,
  });
  return NextResponse.json({ data: { ok: true } });
}
