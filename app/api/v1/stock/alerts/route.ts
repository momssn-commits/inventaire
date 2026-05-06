import { NextRequest } from 'next/server';
import { authorize, apiOk } from '@/lib/api';
import { getStockAlerts } from '@/lib/stock';

/**
 * GET /api/v1/stock/alerts
 * Retourne les produits en rupture, sous-seuil, sur-stock, et le stock dormant.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const alerts = await getStockAlerts(auth.session.companyId);

  function summarize(p: typeof alerts.ruptures[number]) {
    const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
    return {
      id: p.id, sku: p.sku, name: p.name,
      onHand: qty,
      minQty: p.minQty, maxQty: p.maxQty, reorderQty: p.reorderQty,
      cost: p.cost, leadTimeDays: p.leadTimeDays,
    };
  }

  return apiOk({
    ruptures: alerts.ruptures.map(summarize),
    sousSeuil: alerts.sousSeuil.map(summarize),
    surStock: alerts.surStock.map(summarize),
    oldStock: alerts.oldStock.map((s) => ({
      stockLineId: s.id,
      product: { id: s.product.id, sku: s.product.sku, name: s.product.name },
      location: { id: s.location.id, fullPath: s.location.fullPath },
      lot: s.lot ? { id: s.lot.id, name: s.lot.name } : null,
      quantity: s.quantity,
      value: s.quantity * s.unitCost,
      lastUpdated: s.updatedAt,
    })),
    summary: {
      ruptures: alerts.ruptures.length,
      sousSeuil: alerts.sousSeuil.length,
      surStock: alerts.surStock.length,
      oldStock: alerts.oldStock.length,
    },
  });
}
