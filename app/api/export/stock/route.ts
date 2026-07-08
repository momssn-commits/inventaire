import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const lines = await prisma.stockLine.findMany({
    where: {
      product: { companyId: session.companyId, deletedAt: null },
      location: { type: 'internal' },
    },
    include: {
      product: { include: { category: true, uomStock: true } },
      location: { include: { warehouse: true } },
      lot: true,
    },
    orderBy: [{ product: { name: 'asc' } }],
  });

  const rows = [
    ['SKU', 'Désignation', 'Catégorie', 'Local', 'Emplacement', 'Lot / N° Série', 'Quantité', 'Coût unitaire', 'Valeur', 'Unité'].join(';'),
    ...lines.map((l) => [
      l.product.sku,
      `"${l.product.name.replace(/"/g, '""')}"`,
      l.product.category?.name ?? '',
      l.location.warehouse?.name ?? '',
      `"${l.location.fullPath.replace(/"/g, '""')}"`,
      l.lot?.name ?? '',
      l.quantity,
      l.unitCost,
      (l.quantity * l.unitCost).toFixed(0),
      l.product.uomStock?.name ?? '',
    ].join(';')),
  ].join('\n');

  return new NextResponse('﻿' + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stock_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
