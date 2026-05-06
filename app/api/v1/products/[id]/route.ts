import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize, parseJsonBody } from '@/lib/api';
import { logAudit } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

async function findProduct(id: string, companyId: string) {
  return prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      category: true,
      uomStock: true,
      uomPurchase: true,
      uomSale: true,
      preferredSupplier: true,
      stockLines: {
        include: { location: { include: { warehouse: true } }, lot: true },
      },
      lots: { take: 50, orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const product = await findProduct(id, auth.session.companyId);
  if (!product) return apiError('not_found', 'Produit introuvable.', 404);
  return apiOk(product);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const existing = await prisma.product.findFirst({
    where: { id, companyId: auth.session.companyId, deletedAt: null },
  });
  if (!existing) return apiError('not_found', 'Produit introuvable.', 404);

  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (!body) return apiError('invalid_body', 'JSON invalide.', 400);

  const allowed = [
    'name', 'description', 'saleDescription', 'purchaseDescription', 'barcode',
    'type', 'tracking', 'salePrice', 'cost', 'costingMethod', 'invoicePolicy',
    'minQty', 'maxQty', 'reorderQty', 'leadTimeDays', 'safetyDays', 'imageUrl',
    'categoryId', 'preferredSupplierId', 'active',
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];

  try {
    const updated = await prisma.product.update({ where: { id }, data });
    await logAudit({
      action: 'update', entity: 'product', entityId: id,
      oldValue: existing, newValue: data,
      userId: auth.session.userId, companyId: auth.session.companyId,
    });
    return apiOk(updated);
  } catch (e: any) {
    return apiError('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const existing = await prisma.product.findFirst({
    where: { id, companyId: auth.session.companyId, deletedAt: null },
  });
  if (!existing) return apiError('not_found', 'Produit introuvable.', 404);

  // Suffixer le SKU et le code-barres pour libérer la contrainte unique.
  // Sans cela, on ne pourrait pas recréer un produit avec le même SKU après suppression.
  const tombstone = `:deleted:${Date.now()}`;
  await prisma.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      sku: existing.sku + tombstone,
      barcode: existing.barcode ? existing.barcode + tombstone : null,
    },
  });
  await logAudit({
    action: 'delete', entity: 'product', entityId: id,
    oldValue: { sku: existing.sku, barcode: existing.barcode },
    userId: auth.session.userId, companyId: auth.session.companyId,
  });
  return apiOk({ ok: true });
}
