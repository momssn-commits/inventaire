import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiOk, apiError, authorize, parseJsonBody } from '@/lib/api';

/**
 * Décodage GS1 Application Identifiers (AI 01, 10, 17, 21, 30) basique.
 */
function parseGS1(input: string) {
  const raw = input.trim();
  const result: Record<string, string | number> = { raw };
  if (!raw.includes('(')) return result;
  const re = /\((\d{2,4})\)([^()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const [, ai, val] = m;
    if (ai === '01') result.gtin = val;
    else if (ai === '10') result.lot = val;
    else if (ai === '17') {
      const yy = val.slice(0, 2);
      const mm = val.slice(2, 4);
      const dd = val.slice(4, 6);
      const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
      result.expirationDate = `${year}-${mm}-${dd}`;
    } else if (ai === '21') result.serial = val;
    else if (ai === '30') result.qty = Number(val);
  }
  return result;
}

type Body = { code?: string };

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  const body = await parseJsonBody<Body>(req);
  if (!body || !body.code) return apiError('validation_error', 'Le champ "code" est requis.', 422);

  const decoded = parseGS1(body.code);
  const candidates: { type: string; data: any }[] = [];

  // 1. Recherche d'un emplacement par code-barres
  const loc = await prisma.location.findFirst({
    where: { barcode: body.code },
    include: { warehouse: true },
  });
  if (loc) candidates.push({ type: 'location', data: loc });

  // 2. Recherche d'un produit par code-barres principal
  const productByBarcode = await prisma.product.findFirst({
    where: { barcode: body.code, companyId: auth.session.companyId, deletedAt: null },
    include: { uomStock: true, category: true },
  });
  if (productByBarcode) candidates.push({ type: 'product', data: productByBarcode });

  // 3. Recherche d'un lot / numéro de série
  const lotName = (decoded.lot ?? decoded.serial ?? body.code) as string;
  const lot = await prisma.lot.findFirst({
    where: { name: String(lotName), product: { companyId: auth.session.companyId } },
    include: {
      product: true,
      stockLines: { include: { location: { include: { warehouse: true } } } },
    },
  });
  if (lot) candidates.push({ type: 'lot', data: lot });

  // 4. Si on a un GTIN, on tente aussi par barcode du produit
  if (decoded.gtin && !productByBarcode) {
    const p = await prisma.product.findFirst({
      where: { barcode: String(decoded.gtin), companyId: auth.session.companyId },
    });
    if (p) candidates.push({ type: 'product', data: p });
  }

  return apiOk({
    code: body.code,
    decoded,
    matchCount: candidates.length,
    matches: candidates,
  });
}
