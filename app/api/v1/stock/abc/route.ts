import { NextRequest } from 'next/server';
import { authorize, apiOk } from '@/lib/api';
import { getAbcClassification } from '@/lib/stock';

/**
 * GET /api/v1/stock/abc
 * Classification de Pareto par valeur cumulée (A : 0–80 %, B : 80–95 %, C : 95–100 %).
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const classification = await getAbcClassification(auth.session.companyId);
  const totalValue = classification.reduce((s, r) => s + r.value, 0);
  const counts = { A: 0, B: 0, C: 0 };
  const values = { A: 0, B: 0, C: 0 };
  for (const r of classification) {
    counts[r.abc as 'A' | 'B' | 'C']++;
    values[r.abc as 'A' | 'B' | 'C'] += r.value;
  }
  return apiOk({
    summary: {
      totalProducts: classification.length,
      totalValue,
      counts,
      values,
    },
    items: classification.map((r) => ({
      product: { id: r.product.id, sku: r.product.sku, name: r.product.name },
      qty: r.qty,
      value: r.value,
      share: r.share,
      cumulShare: r.cumulShare,
      abc: r.abc,
    })),
  });
}
