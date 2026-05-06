import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RefreshCw, Truck, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatNumber, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function generatePO(formData: FormData) {
  'use server';
  const session = await requireSession();
  const productIds = formData.getAll('productIds').map(String).filter(Boolean);
  if (productIds.length === 0) redirect('/reassort?error=empty');

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId: session.companyId },
    include: {
      preferredSupplier: true,
      stockLines: { where: { location: { type: 'internal' } } },
    },
  });

  // Regrouper par fournisseur
  const bySupplier = new Map<string, typeof products>();
  for (const p of products) {
    const sup = p.preferredSupplier?.id ?? 'NONE';
    if (!bySupplier.has(sup)) bySupplier.set(sup, []);
    bySupplier.get(sup)!.push(p);
  }

  const created: string[] = [];
  for (const [supId, prods] of bySupplier) {
    if (supId === 'NONE') continue;
    const reference = await nextSequence('PO', 'PO', 5);
    const lines = prods.map((p) => {
      const onHand = p.stockLines.reduce((s, l) => s + l.quantity, 0);
      const need = Math.max(p.maxQty - onHand, p.reorderQty);
      const qty = need > 0 ? need : 1;
      return { qty, productId: p.id, unitPrice: p.cost, totalHt: qty * p.cost };
    });
    const po = await prisma.purchaseOrder.create({
      data: {
        reference,
        state: 'draft',
        partnerId: supId,
        companyId: session.companyId,
        totalHt: lines.reduce((s, l) => s + l.totalHt, 0),
        notes: 'Généré automatiquement par le rapport de réassort',
        lines: { create: lines },
      },
    });
    created.push(po.id);
    await logAudit({
      action: 'create', entity: 'purchaseOrder', entityId: po.id,
      newValue: { reference, source: 'reassort' },
      userId: session.userId, companyId: session.companyId,
    });
  }

  if (created.length === 1) redirect(`/achats/${created[0]}`);
  redirect('/achats');
}

export default async function ReassortPage() {
  const session = await requireSession();

  const products = await prisma.product.findMany({
    where: {
      companyId: session.companyId,
      deletedAt: null,
      type: 'storable',
      OR: [{ minQty: { gt: 0 } }, { maxQty: { gt: 0 } }],
    },
    include: {
      preferredSupplier: true,
      uomStock: true,
      stockLines: { where: { location: { type: 'internal' } } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = products
    .map((p) => {
      const onHand = p.stockLines.reduce((s, l) => s + l.quantity, 0);
      const need = Math.max(p.maxQty - onHand, p.reorderQty);
      return {
        product: p,
        onHand,
        need,
        valueAfter: need * p.cost,
        underMin: p.minQty > 0 && onHand < p.minQty,
        outOfStock: onHand <= 0,
      };
    })
    .filter((r) => r.underMin || r.outOfStock);

  const totalValue = rows.reduce((s, r) => s + r.valueAfter, 0);

  return (
    <div>
      <PageHeader
        title="Rapport de réassort"
        subtitle="Calcul des besoins basé sur les seuils min/max et le stock disponible"
        module="M4"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Produits à réapprovisionner</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{rows.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">En rupture</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-red-600">
            {rows.filter((r) => r.outOfStock).length}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Valeur d'achat estimée</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatMoney(totalValue)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={RefreshCw}
            title="Aucun besoin de réassort"
            description="Tous les stocks sont au-dessus de leurs seuils minimum."
          />
        </div>
      ) : (
        <form action={generatePO}>
          <div className="card overflow-x-auto mb-4">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>SKU</th>
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th className="text-right">Disponible</th>
                  <th className="text-right">Min.</th>
                  <th className="text-right">Max.</th>
                  <th className="text-right">À commander</th>
                  <th className="text-right">Délai</th>
                  <th className="text-right">Coût total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id}>
                    <td>
                      <input type="checkbox" name="productIds" value={r.product.id} defaultChecked={!!r.product.preferredSupplier} className="size-4" />
                    </td>
                    <td className="font-mono text-xs">{r.product.sku}</td>
                    <td>
                      <Link href={`/produits/${r.product.id}`} className="text-brand-600 hover:underline">
                        {r.product.name}
                      </Link>
                    </td>
                    <td className="text-sm">
                      {r.product.preferredSupplier?.name ?? (
                        <span className="text-amber-600 inline-flex items-center gap-1 text-xs">
                          <AlertTriangle className="size-3" /> Aucun
                        </span>
                      )}
                    </td>
                    <td className={`text-right tabular-nums ${r.outOfStock ? 'text-red-600 font-medium' : r.underMin ? 'text-amber-600' : ''}`}>
                      {formatNumber(r.onHand, 0)}
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(r.product.minQty, 0)}</td>
                    <td className="text-right tabular-nums">{formatNumber(r.product.maxQty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatNumber(r.need, 0)}</td>
                    <td className="text-right text-xs text-zinc-500">{r.product.leadTimeDays} j</td>
                    <td className="text-right tabular-nums text-sm">{formatMoney(r.valueAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              <Truck className="size-4" /> Générer les bons de commande
            </button>
            <p className="text-xs text-zinc-500">
              Les bons de commande seront générés en brouillon, regroupés par fournisseur.
            </p>
          </div>

          {/* Astuce : on encode tous les ids en une chaîne aussi (fallback) */}
          <input
            type="hidden"
            name="productIdsAll"
            value={rows.map((r) => r.product.id).join(',')}
          />
        </form>
      )}
    </div>
  );
}
