/**
 * Helpers pour l'API REST v1
 * - Authentification : JWT Bearer ou cookie de session
 * - Réponses standardisées
 * - Pagination, tri, filtres
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, type Session } from './auth';

export type ApiContext = {
  session: Session;
  request: NextRequest;
  searchParams: URLSearchParams;
};

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function apiList<T>(
  data: T[],
  meta: { total: number; page: number; perPage: number }
): NextResponse {
  return NextResponse.json({
    data,
    meta: {
      ...meta,
      pageCount: Math.max(1, Math.ceil(meta.total / meta.perPage)),
    },
  });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

/**
 * Vérifie l'authentification : Bearer en priorité, sinon cookie de session.
 * Retourne la session ou une réponse 401.
 */
export async function authorize(
  req: NextRequest
): Promise<{ session: Session } | { response: NextResponse }> {
  // 1. Bearer
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }
  // 2. Cookie
  if (!token) {
    token = req.cookies.get('inv_session')?.value ?? null;
  }
  if (!token) {
    return {
      response: apiError('unauthenticated', 'Authentification requise (Bearer ou cookie de session).', 401),
    };
  }
  const session = await verifySessionToken(token);
  if (!session) {
    return { response: apiError('invalid_token', 'Jeton invalide ou expiré.', 401) };
  }
  return { session };
}

/**
 * Wrapper de handler avec auth + parsing de la query.
 */
export function withAuth<T extends Record<string, string>>(
  handler: (ctx: ApiContext, params: { params: Promise<T> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, params: { params: Promise<T> }) => {
    const auth = await authorize(req);
    if ('response' in auth) return auth.response;
    const url = new URL(req.url);
    return handler({ session: auth.session, request: req, searchParams: url.searchParams }, params);
  };
}

/**
 * Pagination depuis la query string.
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('per_page') ?? 25)));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

/**
 * Parsing du tri.
 * ?sort=field,-other  → [{field: 'asc'}, {other: 'desc'}]
 */
export function parseSort(searchParams: URLSearchParams, allowed: string[]): Record<string, 'asc' | 'desc'>[] {
  const raw = searchParams.get('sort');
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const desc = s.startsWith('-');
      const field = desc ? s.slice(1) : s;
      if (!allowed.includes(field)) return null;
      return { [field]: desc ? 'desc' : 'asc' } as Record<string, 'asc' | 'desc'>;
    })
    .filter((x): x is Record<string, 'asc' | 'desc'> => x !== null);
}

/**
 * Parse un body JSON tolérant aux erreurs.
 */
export async function parseJsonBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Vérifie un champ obligatoire et renvoie une 400 le cas échéant.
 */
export function require_<T>(value: T | undefined | null, name: string): T | NextResponse {
  if (value === undefined || value === null || value === '') {
    return apiError('validation_error', `Le champ « ${name} » est obligatoire.`, 422);
  }
  return value;
}
