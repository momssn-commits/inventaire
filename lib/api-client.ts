/**
 * Bibliothèque cliente — front ↔ API REST v1
 *
 * Toutes les pages client peuvent appeler l'API authentifiée via ces helpers.
 * Le cookie de session est envoyé automatiquement (`credentials: 'include'`).
 */

export type ApiList<T> = {
  data: T[];
  meta: { total: number; page: number; perPage: number; pageCount: number };
};

export type ApiSingle<T> = {
  data: T;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  status: number;
  code: string;
  body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error?.message ?? `HTTP ${status}`);
    this.status = status;
    this.code = body?.error?.code ?? 'http_error';
    this.body = body;
  }
}

const BASE = '/api/v1';

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith('http') ? path : BASE + path;
  const res = await fetch(url, {
    ...init,
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, (parsed as ApiErrorBody) ?? null);
  }
  return parsed as T;
}

// ----------- Endpoints typés -----------

export const api = {
  health: () => request<ApiSingle<{ status: string; version: string; database: string }>>('GET', '/health'),
  me: () => request<ApiSingle<{ id: string; name: string; email: string; role: string; company: { name: string; currency: string } }>>('GET', '/auth/me'),
  stats: () => request<ApiSingle<{
    counters: { products: number; warehouses: number; partners: number; lots: number; pickingsOpen: number; pickingsDone: number; qualityOpen: number; mosOpen: number };
    stock: { units: number; value: number };
  }>>('GET', '/stats'),

  products: {
    list: (params?: { q?: string; type?: string; tracking?: string; page?: number; per_page?: number; sort?: string }) =>
      request<ApiList<{ id: string; sku: string; name: string; type: string; tracking: string; cost: number; salePrice: number }>>(
        'GET', `/products?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
      ),
    get: (id: string) => request<ApiSingle<any>>('GET', `/products/${id}`),
    create: (data: Record<string, unknown>) => request<ApiSingle<any>>('POST', '/products', data),
    update: (id: string, data: Record<string, unknown>) => request<ApiSingle<any>>('PATCH', `/products/${id}`, data),
    remove: (id: string) => request<ApiSingle<{ ok: true }>>('DELETE', `/products/${id}`),
  },

  warehouses: {
    list: () => request<ApiList<{ id: string; code: string; name: string }>>('GET', '/warehouses'),
  },

  lots: {
    get: (name: string) => request<ApiSingle<{
      lot: { id: string; name: string; condition: string | null; brand: string | null; serviceName: string | null; product: { id: string; sku: string; name: string } };
      currentStock: { quantity: number; location: { fullPath: string; warehouse: { code: string } } }[];
      traceability: { ascending: any[]; descending: any[] };
    }>>('GET', `/lots/${encodeURIComponent(name)}`),
  },

  scan: (code: string) => request<ApiSingle<{
    code: string;
    decoded: Record<string, string | number>;
    matchCount: number;
    matches: { type: string; data: any }[];
  }>>('POST', '/scan', { code }),

  stock: {
    list: (params?: { warehouse_id?: string; product_id?: string; only_internal?: boolean; only_positive?: boolean; per_page?: number }) =>
      request<ApiList<any>>(
        'GET', `/stock?${new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
      ),
    alerts: () => request<ApiSingle<any>>('GET', '/stock/alerts'),
    abc: () => request<ApiSingle<any>>('GET', '/stock/abc'),
    transfer: (data: { productId: string; fromLocationId: string; toLocationId: string; qty: number; lotId?: string; notes?: string }) =>
      request<ApiSingle<any>>('POST', '/stock/transfer', data),
  },
};
