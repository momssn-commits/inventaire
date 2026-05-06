import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed minimal — base vierge.
 * Crée uniquement :
 *   - une société
 *   - un compte administrateur
 *   - les unités de mesure de référence (nécessaires au schéma Produit)
 *   - les compteurs de séquence
 *
 * Aucune donnée de démo : ni produit, ni entrepôt, ni partenaire, ni mouvement.
 */
async function main() {
  console.log('🌱 Initialisation de la base vierge...');

  // ---------- Société ----------
  // UUID déterministe pour stabiliser les jetons de session entre les resets.
  const COMPANY_ID = '00000000-0000-0000-0000-00000000c0de';
  const ADMIN_USER_ID = '00000000-0000-0000-0000-0000000a0011';
  const company = await prisma.company.upsert({
    where: { code: 'DEMO' },
    update: { id: COMPANY_ID },
    create: { id: COMPANY_ID, code: 'DEMO', name: 'Ma Société', currency: 'XOF', locale: 'fr-FR' },
  });

  // ---------- Compte administrateur ----------
  const adminPwd = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@inventaire.fr' },
    update: { id: ADMIN_USER_ID, companyId: company.id },
    create: {
      id: ADMIN_USER_ID,
      email: 'admin@inventaire.fr',
      name: 'Administrateur',
      passwordHash: adminPwd,
      role: 'admin',
      companyId: company.id,
    },
  });

  // ---------- Unités de mesure (référentiel obligatoire) ----------
  const existingUoms = await prisma.uom.count();
  if (existingUoms === 0) {
    const uomCats: Record<string, { name: string; symbol: string; factor: number; ref?: boolean }[]> = {
      'Unités': [
        { name: 'Pièce', symbol: 'u', factor: 1, ref: true },
        { name: 'Douzaine', symbol: 'dz', factor: 12 },
        { name: 'Paire', symbol: 'pr', factor: 2 },
      ],
      'Poids': [
        { name: 'Kilogramme', symbol: 'kg', factor: 1, ref: true },
        { name: 'Gramme', symbol: 'g', factor: 0.001 },
        { name: 'Tonne', symbol: 't', factor: 1000 },
      ],
      'Volume': [
        { name: 'Litre', symbol: 'L', factor: 1, ref: true },
        { name: 'Millilitre', symbol: 'mL', factor: 0.001 },
        { name: 'Mètre cube', symbol: 'm³', factor: 1000 },
      ],
      'Longueur': [
        { name: 'Mètre', symbol: 'm', factor: 1, ref: true },
        { name: 'Centimètre', symbol: 'cm', factor: 0.01 },
        { name: 'Kilomètre', symbol: 'km', factor: 1000 },
      ],
      'Surface': [
        { name: 'Mètre carré', symbol: 'm²', factor: 1, ref: true },
      ],
      'Temps': [
        { name: 'Heure', symbol: 'h', factor: 1, ref: true },
        { name: 'Minute', symbol: 'min', factor: 1 / 60 },
      ],
    };

    for (const [catName, uoms] of Object.entries(uomCats)) {
      const cat = await prisma.uomCategory.upsert({
        where: { name: catName },
        update: {},
        create: { name: catName },
      });
      for (const u of uoms) {
        await prisma.uom.create({
          data: {
            name: u.name,
            symbol: u.symbol,
            factor: u.factor,
            isReference: !!u.ref,
            uomCategoryId: cat.id,
          },
        });
      }
    }
  }

  // ---------- Compteurs de séquence ----------
  const seqs = [
    { code: 'PICKING_RECEIPT', prefix: 'WH/IN/', padding: 5, next: 1 },
    { code: 'PICKING_DELIVERY', prefix: 'WH/OUT/', padding: 5, next: 1 },
    { code: 'PICKING_INTERNAL', prefix: 'WH/INT/', padding: 5, next: 1 },
    { code: 'PO', prefix: 'PO', padding: 5, next: 1 },
    { code: 'MO', prefix: 'MO', padding: 5, next: 1 },
    { code: 'COUNT', prefix: 'INV/', padding: 5, next: 1 },
    { code: 'QA', prefix: 'QA', padding: 5, next: 1 },
    { code: 'REPAIR', prefix: 'REP', padding: 5, next: 1 },
    { code: 'MR', prefix: 'MR', padding: 5, next: 1 },
  ];
  for (const s of seqs) {
    await prisma.sequence.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }

  console.log('✅ Base vierge prête.');
  console.log('');
  console.log('Compte de connexion administrateur :');
  console.log('   admin@inventaire.fr  /  admin123');
  console.log('');
  console.log('Aucune donnée métier n\'a été importée.');
  console.log('Commencez par créer un entrepôt, puis vos produits.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
