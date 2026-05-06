import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'inventaire-dev-secret-change-in-production-please'
);

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/v1/auth/login',
  '/api/v1/health',
  '/api/v1/openapi.json',
  '/api/docs',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Routes API : ce sont les handlers qui authentifient via Bearer + cookie.
  // Le middleware ne doit pas rediriger vers /login pour ces routes.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('inv_session')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)'],
};
