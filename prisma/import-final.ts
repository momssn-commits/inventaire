/**
 * Import du fichier d'inventaire FINAL des immobilisations.
 * Source : IFS_Fichier d'inventaire brut.xlsx (document final validé)
 *
 * Mode : REMPLACEMENT COMPLET (miroir exact du fichier)
 *   - Purge StockLine, Lot, Location, Warehouse, Product
 *   - 1 désignation (Standard) = 1 Produit (tracking="serial")
 *   - 1 site = 1 Entrepôt ; hiérarchie Site → Bâtiment → Niveau → Local
 *   - 1 ligne = 1 actif (Lot isSerial=true) + StockLine qty=1
 *   - StockLine.unitCost = Valeur comptable nette
 *   - Lot conserve codeImmo, valeur brute, amortissement, valeur comptable
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();

const XLSX_PATH = process.argv[2];
if (!XLSX_PATH) { console.error('Usage: tsx import-final.ts <chemin.xlsx>'); process.exit(1); }

type Row = {
  codeImmo: string | null;
  codeBarre: string;
  designation: string;
  condition: string | null;
  marque: string | null;
  specifications: string | null;
  valeurBrute: number;
  amortissement: number;
  valeurComptable: number;
  site: string;
  batiment: string;
  niveau: string;
  local: string;
  service: string | null;
};

function readRows(path: string): Row[] {
  const json = execSync(
    `python3 -c "
import pandas as pd, json, math
df = pd.read_excel('${path.replace(/'/g, "\\'")}')
def clean(v):
    if v is None: return None
    try:
        if isinstance(v, float) and math.isnan(v): return None
    except Exception: pass
    if pd.isna(v): return None
    return v
def num(v):
    v = clean(v)
    try: return float(v) if v is not None else 0.0
    except Exception: return 0.0
def txt(v):
    v = clean(v)
    if v is None: return None
    if isinstance(v, float) and v.is_integer(): v = int(v)
    return str(v).strip() or None
out = []
for _, r in df.iterrows():
    out.append({
        'codeImmo': txt(r.get('Code Immos')),
        'codeBarre': str(clean(r.get('Code barre')) or '').strip(),
        'designation': str(clean(r.get('Standard')) or '').strip(),
        'condition': txt(r.get('Condition/Condition')),
        'marque': txt(r.get('Marque')),
        'specifications': txt(r.get('Spécifications')),
        'valeurBrute': num(r.get('Valeur brute')),
        'amortissement': num(r.get('Amortissement')),
        'valeurComptable': num(r.get('Valeur comptable')),
        'site': str(clean(r.get('Site/Display Name')) or '').strip(),
        'batiment': str(clean(r.get('Bâtiment/Name')) or '').strip(),
        'niveau': str(clean(r.get('Niveau/Name')) or '').strip(),
        'local': str(clean(r.get('Local/Name')) or '').strip(),
        'service': txt(r.get('Service/Name')),
    })
print(json.dumps(out, ensure_ascii=False, allow_nan=False))
" 2>/dev/null`,
    { maxBuffer: 128 * 1024 * 1024 }
  ).toString();
  return JSON.parse(json);
}

function siteCode(name: string): string {
  const map: Record<string, string> = {
    'SIEGE SOCIAL (GOMIS)': 'SIEGE',
    'IFS SAINT LOUIS': 'STLOUIS',
    'CAMPUS FRANCE': 'CFR',
    'PARCHAPPE': 'PARCH',
  };
  return map[name] ?? name.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
}

function makeSku(designation: string, used: Set<string>): string {
  const base = 'IM-' + designation
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/gi, '-').toUpperCase()
    .replace(/^-|-$/g, '').slice(0, 28);
  let sku = base || 'IM-X'; let i = 2;
  while (used.has(sku)) sku = `${base}-${i++}`;
  used.add(sku);
  return sku;
}

async function main() {
  console.log(`📂 Lecture : ${XLSX_PATH}`);
  const rows = readRows(XLSX_PATH);
  const validRows = rows.filter((r) => r.codeBarre && r.designation);
  console.log(`   ${rows.length} lignes lues, ${validRows.length} valides.`);

  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Aucune société.');
  const uomPiece = await prisma.uom.findFirst({ where: { symbol: 'u' } });
  if (!uomPiece) throw new Error('UoM Pièce (u) introuvable.');

  // ---------- PURGE (remplacement complet, ordre des dépendances) ----------
  console.log('🗑  Purge de l\'inventaire existant...');
  await prisma.qualityCheck.deleteMany({});
  await prisma.qualityAlert.deleteMany({});
  await prisma.qualityCheckPoint.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.manufacturingOrder.deleteMany({});
  await prisma.bomOperation.deleteMany({});
  await prisma.bomComponent.deleteMany({});
  await prisma.bom.deleteMany({});
  await prisma.repairOrder.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.purchaseOrderLine.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.countLine.deleteMany({});
  await prisma.countSheet.deleteMany({});
  await prisma.pickingLine.deleteMany({});
  await prisma.picking.deleteMany({});
  await prisma.stockLine.deleteMany({});
  await prisma.lot.deleteMany({});
  await prisma.putawayRule.deleteMany({});
  await prisma.productPackaging.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('   OK.');

  // ---------- Catégorie ----------
  const cat = await prisma.category.upsert({
    where: { id: 'cat-immo' },
    update: {},
    create: { id: 'cat-immo', name: 'Immobilisations corporelles', costingMethod: 'standard' },
  });

  // ---------- Entrepôts (sites) ----------
  const siteToWh = new Map<string, string>();
  for (const site of Array.from(new Set(validRows.map((r) => r.site)))) {
    const wh = await prisma.warehouse.create({
      data: { code: siteCode(site), name: site, country: 'SN', receptionSteps: 1, deliverySteps: 1, companyId: company.id },
    });
    siteToWh.set(site, wh.id);
  }
  console.log(`🏢 ${siteToWh.size} site(s).`);

  // ---------- Emplacements ----------
  const locCache = new Map<string, string>();
  async function ensureLoc(o: { name: string; fullPath: string; type: string; warehouseId: string; parentId?: string | null }) {
    const c = locCache.get(o.fullPath); if (c) return c;
    const created = await prisma.location.create({
      data: { name: o.name, fullPath: o.fullPath, type: o.type, warehouseId: o.warehouseId, parentId: o.parentId ?? null },
    });
    locCache.set(o.fullPath, created.id); return created.id;
  }
  const locKeys = new Map<string, Row>();
  for (const r of validRows) locKeys.set(`${r.site}|${r.batiment}|${r.niveau}|${r.local}`, r);
  for (const r of locKeys.values()) {
    const whId = siteToWh.get(r.site)!; const code = siteCode(r.site);
    const stockId = await ensureLoc({ name: 'Stock', fullPath: `${code}/Stock`, type: 'view', warehouseId: whId });
    const batId = await ensureLoc({ name: r.batiment, fullPath: `${code}/Stock/${r.batiment}`, type: 'view', warehouseId: whId, parentId: stockId });
    const nivId = await ensureLoc({ name: r.niveau, fullPath: `${code}/Stock/${r.batiment}/${r.niveau}`, type: 'view', warehouseId: whId, parentId: batId });
    await ensureLoc({ name: r.local, fullPath: `${code}/Stock/${r.batiment}/${r.niveau}/${r.local}`, type: 'internal', warehouseId: whId, parentId: nivId });
  }
  console.log(`📍 ${locCache.size} emplacements.`);

  // ---------- Produits (1 par désignation) ----------
  const designations = Array.from(new Set(validRows.map((r) => r.designation))).sort();
  const desToProduct = new Map<string, string>();
  const usedSkus = new Set<string>();
  for (const d of designations) {
    const p = await prisma.product.create({
      data: {
        sku: makeSku(d, usedSkus), name: d, type: 'storable', tracking: 'serial',
        cost: 0, salePrice: 0, costingMethod: 'standard', invoicePolicy: 'order', active: true,
        companyId: company.id, categoryId: cat.id, uomStockId: uomPiece.id,
      },
    });
    desToProduct.set(d, p.id);
  }
  console.log(`📦 ${desToProduct.size} fiches produits.`);

  // ---------- Actifs (Lots) + StockLines ----------
  console.log('🏷  Import des actifs...');
  let nLots = 0, nStock = 0, skipped = 0;
  const batchSize = 200;
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    await prisma.$transaction(async (tx) => {
      for (const r of batch) {
        const productId = desToProduct.get(r.designation);
        const code = siteCode(r.site);
        const locationId = locCache.get(`${code}/Stock/${r.batiment}/${r.niveau}/${r.local}`);
        if (!productId || !locationId) { skipped++; continue; }
        const lot = await tx.lot.create({
          data: {
            name: r.codeBarre, productId, isSerial: true,
            condition: r.condition, brand: r.marque, specifications: r.specifications, serviceName: r.service,
            codeImmo: r.codeImmo, grossValue: r.valeurBrute, depreciation: r.amortissement, bookValue: r.valeurComptable,
          },
        });
        nLots++;
        await tx.stockLine.create({
          data: { productId, locationId, lotId: lot.id, quantity: 1, unitCost: r.valeurComptable },
        });
        nStock++;
      }
    });
    process.stdout.write(`   ${Math.min(i + batchSize, validRows.length)}/${validRows.length}\r`);
  }
  console.log(`\n✅ ${nLots} actifs, ${nStock} lignes de stock.${skipped ? ` ${skipped} ignorées.` : ''}`);

  const [wh, loc, prod, lots, stock] = await Promise.all([
    prisma.warehouse.count(), prisma.location.count(), prisma.product.count(), prisma.lot.count(), prisma.stockLine.count(),
  ]);
  const agg = await prisma.stockLine.aggregate({ _sum: { unitCost: true } });
  console.log(`\n📊 Totaux : sites=${wh} emplacements=${loc} produits=${prod} actifs=${lots} stock=${stock}`);
  console.log(`   Valeur comptable totale = ${(agg._sum.unitCost ?? 0).toLocaleString('fr-FR')} FCFA`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
