/**
 * Import des données réelles d'inventaire d'immobilisations
 * Source : 26003. IFS_Inventaire immos_rapport avancement_fichier inventaire brut_v0.xlsx
 *
 * Stratégie :
 *   - 1 désignation unique = 1 fiche Produit (tracking="serial")
 *   - 1 site = 1 Entrepôt
 *   - Hiérarchie d'emplacements : Site → Bâtiment → Niveau → Local
 *   - 1 ligne du fichier = 1 actif individuel (Lot avec isSerial=true) + StockLine qty=1
 *   - Condition / marque / spécifications / service stockés dans Lot.condition/brand/...
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();

const XLSX_PATH =
  process.argv[2] ??
  '/Users/technique1/Desktop/Inventaires/26003. IFS_Inventaire immos_rapport avancement_fichier inventaire brut_v0.xlsx';

type Row = {
  codeBarre: string;
  designation: string;
  condition: string | null;
  marque: string | null;
  specifications: string | null;
  site: string;
  batiment: string;
  niveau: string;
  local: string;
  direction: string | null;
  departement: string | null;
  service: string | null;
};

function readRows(path: string): Row[] {
  // Convertir l'XLSX en JSON via un petit script Python (déjà dispo via le skill xlsx)
  const json = execSync(
    `python3 -c "
import pandas as pd, json, sys
df = pd.read_excel('${path.replace(/'/g, "\\'")}')
df = df.where(pd.notnull(df), None)
out = []
for _, r in df.iterrows():
    out.append({
        'codeBarre': str(r.get('Code barre') or '').strip(),
        'designation': str(r.get('Standard/Nom') or '').strip(),
        'condition': r.get('Condition/Condition'),
        'marque': r.get('Marque'),
        'specifications': r.get('Spécifications'),
        'site': str(r.get('Site/Name') or '').strip(),
        'batiment': str(r.get('Bâtiment/Name') or '').strip(),
        'niveau': str(r.get('Niveau/Name') or '').strip(),
        'local': str(r.get('Local/Name') or '').strip(),
        'direction': r.get('Direction/Name'),
        'departement': r.get('Département/Name'),
        'service': r.get('Service/Name'),
    })
print(json.dumps(out, ensure_ascii=False))
" 2>/dev/null`,
    { maxBuffer: 64 * 1024 * 1024 }
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

// SKU stable basé sur le hash de la désignation
function makeSku(designation: string, used: Set<string>): string {
  const base = 'IM-' + designation
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/gi, '-')
    .toUpperCase()
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  let sku = base;
  let i = 2;
  while (used.has(sku)) sku = `${base}-${i++}`;
  used.add(sku);
  return sku;
}

async function main() {
  console.log(`📂 Lecture du fichier : ${XLSX_PATH}`);
  const rows = readRows(XLSX_PATH);
  console.log(`   ${rows.length} lignes lues.`);

  // Filtre : ignorer les lignes sans code-barres ou désignation
  const validRows = rows.filter((r) => r.codeBarre && r.designation);
  console.log(`   ${validRows.length} lignes valides.`);

  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Aucune société. Lancez d\'abord npm run db:seed.');

  const uomPiece = await prisma.uom.findFirst({ where: { symbol: 'u' } });
  if (!uomPiece) throw new Error('UoM Pièce introuvable.');

  // ---------- Catégorie unique ----------
  const cat = await prisma.category.upsert({
    where: { id: 'cat-immo' },
    update: {},
    create: { id: 'cat-immo', name: 'Immobilisations corporelles', costingMethod: 'standard' },
  });

  // ---------- Entrepôts (1 par site) ----------
  console.log('🏢 Création des entrepôts...');
  const siteToWh = new Map<string, string>();
  const sites = Array.from(new Set(validRows.map((r) => r.site)));
  for (const site of sites) {
    const code = siteCode(site);
    const wh = await prisma.warehouse.upsert({
      where: { code },
      update: { name: site },
      create: {
        code,
        name: site,
        country: 'SN',
        receptionSteps: 1,
        deliverySteps: 1,
        companyId: company.id,
      },
    });
    siteToWh.set(site, wh.id);
  }
  console.log(`   ${siteToWh.size} entrepôt(s).`);

  // ---------- Hiérarchie d'emplacements ----------
  console.log('📍 Création de la hiérarchie d\'emplacements...');
  const locCache = new Map<string, string>(); // fullPath -> id

  async function ensureLoc(opts: {
    name: string;
    fullPath: string;
    type: string;
    warehouseId?: string | null;
    parentId?: string | null;
  }): Promise<string> {
    const cached = locCache.get(opts.fullPath);
    if (cached) return cached;
    const existing = await prisma.location.findFirst({
      where: { fullPath: opts.fullPath },
    });
    if (existing) {
      locCache.set(opts.fullPath, existing.id);
      return existing.id;
    }
    const created = await prisma.location.create({
      data: {
        name: opts.name,
        fullPath: opts.fullPath,
        type: opts.type,
        warehouseId: opts.warehouseId ?? null,
        parentId: opts.parentId ?? null,
      },
    });
    locCache.set(opts.fullPath, created.id);
    return created.id;
  }

  // Déduire toutes les combinaisons site/bâtiment/niveau/local
  const locKeys = new Map<string, Row>();
  for (const r of validRows) {
    const key = `${r.site}|${r.batiment}|${r.niveau}|${r.local}`;
    if (!locKeys.has(key)) locKeys.set(key, r);
  }
  console.log(`   ${locKeys.size} emplacements distincts à créer.`);

  for (const r of locKeys.values()) {
    const whId = siteToWh.get(r.site)!;
    const code = siteCode(r.site);
    const stockId = await ensureLoc({
      name: 'Stock',
      fullPath: `${code}/Stock`,
      type: 'view',
      warehouseId: whId,
    });
    const batId = await ensureLoc({
      name: r.batiment,
      fullPath: `${code}/Stock/${r.batiment}`,
      type: 'view',
      warehouseId: whId,
      parentId: stockId,
    });
    const nivId = await ensureLoc({
      name: r.niveau,
      fullPath: `${code}/Stock/${r.batiment}/${r.niveau}`,
      type: 'view',
      warehouseId: whId,
      parentId: batId,
    });
    await ensureLoc({
      name: r.local,
      fullPath: `${code}/Stock/${r.batiment}/${r.niveau}/${r.local}`,
      type: 'internal',
      warehouseId: whId,
      parentId: nivId,
    });
  }
  console.log(`   ${locCache.size} emplacements en base.`);

  // ---------- Produits (1 par désignation, déduplication par nom+companyId) ----------
  console.log('📦 Création des fiches produits...');
  const designations = Array.from(new Set(validRows.map((r) => r.designation))).sort();
  const designationToProduct = new Map<string, string>();

  // Charger les produits existants de la même catégorie pour réutiliser leurs IDs
  const existingProducts = await prisma.product.findMany({
    where: { companyId: company.id, categoryId: cat.id, deletedAt: null },
    select: { id: true, name: true },
  });
  for (const p of existingProducts) {
    designationToProduct.set(p.name, p.id);
  }

  const usedSkus = new Set<string>(
    (await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku)
  );

  let createdProducts = 0;
  for (const d of designations) {
    if (designationToProduct.has(d)) continue;
    const sku = makeSku(d, usedSkus);
    const product = await prisma.product.create({
      data: {
        sku,
        name: d,
        type: 'storable',
        tracking: 'serial',
        cost: 0,
        salePrice: 0,
        costingMethod: 'standard',
        invoicePolicy: 'order',
        active: true,
        companyId: company.id,
        categoryId: cat.id,
        uomStockId: uomPiece.id,
      },
    });
    designationToProduct.set(d, product.id);
    createdProducts++;
  }
  console.log(`   ${designationToProduct.size} fiches produits (dont ${createdProducts} nouvelles).`);

  // ---------- Lots (= actifs individuels) + StockLines ----------
  console.log('🏷  Création des actifs individuels...');
  let createdLots = 0;
  let createdStock = 0;
  let skipped = 0;

  // Insertion en transactions par batch de 200
  const batchSize = 200;
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    await prisma.$transaction(async (tx) => {
      for (const r of batch) {
        const productId = designationToProduct.get(r.designation);
        if (!productId) {
          skipped++;
          continue;
        }
        const code = siteCode(r.site);
        const fullPath = `${code}/Stock/${r.batiment}/${r.niveau}/${r.local}`;
        const locationId = locCache.get(fullPath);
        if (!locationId) {
          skipped++;
          continue;
        }

        // Création du lot (déduplication par productId+name géré par contrainte unique)
        const existing = await tx.lot.findUnique({
          where: { productId_name: { productId, name: r.codeBarre } },
        });
        let lotId: string;
        if (existing) {
          lotId = existing.id;
        } else {
          const lot = await tx.lot.create({
            data: {
              name: r.codeBarre,
              productId,
              isSerial: true,
              condition: r.condition,
              brand: r.marque,
              specifications: r.specifications,
              serviceName: r.service,
            },
          });
          lotId = lot.id;
          createdLots++;
        }

        // StockLine qty=1
        const sl = await tx.stockLine.findFirst({
          where: { productId, locationId, lotId },
        });
        if (!sl) {
          await tx.stockLine.create({
            data: { productId, locationId, lotId, quantity: 1, unitCost: 0 },
          });
          createdStock++;
        }
      }
    });
    if ((i + batchSize) % 1000 < batchSize) {
      process.stdout.write(`   ${Math.min(i + batchSize, validRows.length)}/${validRows.length}\r`);
    }
  }

  console.log(`\n✅ Import terminé.`);
  console.log(`   ${createdLots} actifs (lots/N° série) créés.`);
  console.log(`   ${createdStock} lignes de stock créées.`);
  if (skipped > 0) console.log(`   ${skipped} lignes ignorées (produit ou emplacement manquant).`);

  // Récap
  const totals = await Promise.all([
    prisma.warehouse.count(),
    prisma.location.count(),
    prisma.product.count(),
    prisma.lot.count(),
    prisma.stockLine.count(),
  ]);
  console.log(`\n📊 Totaux en base :`);
  console.log(`   Entrepôts        : ${totals[0]}`);
  console.log(`   Emplacements     : ${totals[1]}`);
  console.log(`   Produits         : ${totals[2]}`);
  console.log(`   Lots / N° série  : ${totals[3]}`);
  console.log(`   Lignes de stock  : ${totals[4]}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
