import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    include: {
      category: true,
      stockLines: { where: { location: { type: 'internal' } }, select: { quantity: true, unitCost: true } },
      uomStock: true,
    },
    orderBy: { name: 'asc' },
  });

  const rows = [
    ['SKU', 'Désignation', 'Type', 'Suivi', 'Catégorie', 'Unité', 'Stock', 'Stock min', 'Coût', 'Prix vente', 'Code-barres', 'Notes'].join(';'),
    ...products.map((p) => {
      const qty = p.stockLines.reduce((s, l) => s + l.quantity, 0);
      return [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.type,
        p.tracking,
        p.category?.name ?? '',
        p.uomStock?.name ?? '',
        qty,
        p.minQty,
        p.cost,
        p.salePrice,
        p.barcode ?? '',
        `"${(p.description ?? '').replace(/"/g, '""')}"`,
      ].join(';');
    }),
  ].join('\n');

  return new NextResponse('﻿' + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="produits_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
