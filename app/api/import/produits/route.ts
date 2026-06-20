import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Row = {
  sku?: string; nom?: string; name?: string;
  type?: string; suivi?: string; tracking?: string;
  barcode?: string; cout?: string; cost?: string;
  saleprice?: string; salePrice?: string;
  minqty?: string; minQty?: string;
  notes?: string;
};

function num(v?: string) { const n = parseFloat(String(v ?? '').replace(/\s/g, '')); return isNaN(n) ? 0 : n; }
function str(v?: string) { return (v ?? '').trim(); }

export async function POST(req: NextRequest) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json();
  const rows: Row[] = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
  }

  // UOM par défaut (unité de référence)
  const defaultUom = await prisma.uom.findFirst({ where: { isReference: true } })
    ?? await prisma.uom.findFirst();
  if (!defaultUom) {
    return NextResponse.json({ error: 'Aucune unité de mesure configurée' }, { status: 400 });
  }

  let ok = 0;
  const errors: { row: number; sku: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sku = str(r.sku);
    const name = str(r.nom ?? r.name);
    if (!sku) { errors.push({ row: i + 2, sku: '', error: 'SKU manquant' }); continue; }
    if (!name) { errors.push({ row: i + 2, sku, error: 'Nom manquant' }); continue; }

    const typeRaw = str(r.type).toLowerCase();
    const type = ['storable', 'consumable', 'service'].includes(typeRaw) ? typeRaw : 'storable';
    const trackingRaw = str(r.suivi ?? r.tracking).toLowerCase();
    const tracking = ['lot', 'serial'].includes(trackingRaw) ? trackingRaw : 'none';
    const barcode = str(r.barcode) || null;
    const cost = num(r.cout ?? r.cost);
    const salePrice = num(r.saleprice ?? r.salePrice);
    const minQty = num(r.minqty ?? r.minQty);
    const notes = str(r.notes) || null;

    try {
      await prisma.product.upsert({
        where: { sku },
        update: { name, type, tracking, cost, salePrice, minQty, description: notes, ...(barcode ? { barcode } : {}) },
        create: { sku, name, type, tracking, cost, salePrice, minQty, description: notes, ...(barcode ? { barcode } : {}), companyId: session.companyId, uomStockId: defaultUom.id },
      });
      ok++;
    } catch (err: any) {
      errors.push({ row: i + 2, sku, error: err?.message ?? 'Erreur inconnue' });
    }
  }

  return NextResponse.json({ ok, errors });
}
