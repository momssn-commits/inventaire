import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

async function handle(req: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const GET = handle;
export const POST = handle;
