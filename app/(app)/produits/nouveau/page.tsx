import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';

async function createProduct(formData: FormData) {
  'use server';
  const session = await requireSession();
  const sku = String(formData.get('sku') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!sku || !name) redirect('/produits/nouveau?error=missing');

  const uomStock = await prisma.uom.findFirst({ where: { symbol: 'u' } });
  if (!uomStock) throw new Error('UoM par défaut introuvable');

  const product = await prisma.product.create({
    data: {
      sku,
      name,
      barcode: String(formData.get('barcode') ?? '') || null,
      description: String(formData.get('description') ?? '') || null,
      type: String(formData.get('type') ?? 'storable'),
      tracking: String(formData.get('tracking') ?? 'none'),
      salePrice: Number(formData.get('salePrice') ?? 0),
      cost: Number(formData.get('cost') ?? 0),
      costingMethod: String(formData.get('costingMethod') ?? 'standard'),
      invoicePolicy: String(formData.get('invoicePolicy') ?? 'order'),
      minQty: Number(formData.get('minQty') ?? 0),
      maxQty: Number(formData.get('maxQty') ?? 0),
      reorderQty: Number(formData.get('reorderQty') ?? 0),
      leadTimeDays: Number(formData.get('leadTimeDays') ?? 0),
      categoryId: String(formData.get('categoryId') ?? '') || null,
      companyId: session.companyId,
      uomStockId: uomStock.id,
    },
  });

  await logAudit({
    action: 'create',
    entity: 'product',
    entityId: product.id,
    newValue: { sku, name },
    userId: session.userId,
    companyId: session.companyId,
  });

  redirect(`/produits/${product.id}`);
}

export default async function NewProductPage() {
  await requireSession();
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nouveau produit"
        subtitle="Créez une fiche produit complète"
        module="M1"
        actions={
          <Link href="/produits" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>
        }
      />

      <form action={createProduct} className="space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Identification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Référence interne (SKU) *</label>
              <input name="sku" required className="input" placeholder="ex: PF-001" />
            </div>
            <div>
              <label className="label">Code-barres principal</label>
              <input name="barcode" className="input" placeholder="EAN-13, UPC-A, Code-128…" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Désignation *</label>
              <input name="name" required className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" className="input" rows={3} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Type & traçabilité</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="storable">
                <option value="storable">Stockable</option>
                <option value="consumable">Consommable</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div>
              <label className="label">Suivi</label>
              <select name="tracking" className="input" defaultValue="none">
                <option value="none">Aucun suivi</option>
                <option value="lot">Par lot</option>
                <option value="serial">Numéro de série</option>
              </select>
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select name="categoryId" className="input" defaultValue="">
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Prix & valorisation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Prix de vente HT (FCFA)</label>
              <input name="salePrice" type="number" step="100" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Coût d'achat (FCFA)</label>
              <input name="cost" type="number" step="100" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Méthode de valorisation</label>
              <select name="costingMethod" className="input" defaultValue="standard">
                <option value="standard">Prix standard</option>
                <option value="average">Prix moyen pondéré</option>
                <option value="fifo">FIFO</option>
              </select>
            </div>
            <div>
              <label className="label">Politique de facturation</label>
              <select name="invoicePolicy" className="input" defaultValue="order">
                <option value="order">À la commande</option>
                <option value="delivery">À la livraison</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-4">Réassort</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Stock minimum</label>
              <input name="minQty" type="number" step="1" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Stock maximum</label>
              <input name="maxQty" type="number" step="1" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Quantité multiple</label>
              <input name="reorderQty" type="number" step="1" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Délai (jours)</label>
              <input name="leadTimeDays" type="number" step="1" min="0" className="input" defaultValue="0" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">Créer le produit</button>
          <Link href="/produits" className="btn-ghost">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
