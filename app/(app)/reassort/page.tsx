import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Zap, Truck, AlertTriangle, TrendingDown, PackageX, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatNumber, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';

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

export default async function ReassortPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

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
        need: need > 0 ? need : 0,
        valueAfter: need > 0 ? need * p.cost : 0,
        underMin: p.minQty > 0 && onHand < p.minQty,
        outOfStock: onHand <= 0,
        coveragePct: p.maxQty > 0 ? Math.min(100, (onHand / p.maxQty) * 100) : null,
      };
    })
    .filter((r) => r.underMin || r.outOfStock);

  const ruptures = rows.filter((r) => r.outOfStock).length;
  const sousMin = rows.filter((r) => !r.outOfStock && r.underMin).length;
  const sansSupplier = rows.filter((r) => !r.product.preferredSupplier).length;
  const totalValue = rows.reduce((s, r) => s + r.valueAfter, 0);

  return (
    <div>
      <PageHeader
        title="Réassort"
        subtitle="Produits sous le seuil minimum — génération automatique des bons de commande"
        module="M4"
      />

      {sp.error === 'empty' && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          Sélectionnez au moins un produit avant de générer les bons de commande.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ruptures" value={ruptures} icon={PackageX} tone="danger" />
        <KpiCard label="Sous le min" value={sousMin} icon={TrendingDown} tone="warning" />
        <KpiCard label="Sans fournisseur" value={sansSupplier} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Valeur estimée" value={formatMoney(totalValue)} icon={Zap} tone="info" />
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="size-12 mx-auto text-green-400 mb-3" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Tous les stocks sont au-dessus des seuils</p>
          <p className="text-sm text-zinc-400 mt-1">Aucun réassort nécessaire pour le moment.</p>
        </div>
      ) : (
        <form action={generatePO}>
          <div className="card overflow-x-auto mb-4">
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <p className="text-sm font-medium">{rows.length} produit{rows.length > 1 ? 's' : ''} à réapprovisionner</p>
              <p className="text-xs text-zinc-400">Cochez les produits à commander</p>
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th className="text-right">Disponible</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Max</th>
                  <th className="text-right">À commander</th>
                  <th className="text-right">Délai</th>
                  <th className="text-right">Coût total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id} className={r.outOfStock ? 'bg-red-50/40 dark:bg-red-900/10' : r.underMin ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        name="productIds"
                        value={r.product.id}
                        defaultChecked={!!r.product.preferredSupplier}
                        className="size-4"
                      />
                    </td>
                    <td>
                      <div>
                        <Link href={`/produits/${r.product.id}`} className="text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium">
                          {r.product.name}
                        </Link>
                        <div className="font-mono text-[10px] text-zinc-400">{r.product.sku}</div>
                      </div>
                    </td>
                    <td className="text-sm">
                      {r.product.preferredSupplier?.name ?? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="size-3" /> Aucun
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      <span className={`font-medium text-sm ${r.outOfStock ? 'text-red-600' : r.underMin ? 'text-amber-600' : ''}`}>
                        {formatNumber(r.onHand, 0)}
                        {r.outOfStock && <span className="ml-1 text-xs">⚠ Rupture</span>}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-sm text-zinc-500">{formatNumber(r.product.minQty, 0)}</td>
                    <td className="text-right tabular-nums text-sm text-zinc-500">{formatNumber(r.product.maxQty, 0)}</td>
                    <td className="text-right tabular-nums font-semibold text-sm">{formatNumber(r.need, 0)}</td>
                    <td className="text-right text-xs text-zinc-500">{r.product.leadTimeDays} j</td>
                    <td className="text-right tabular-nums text-sm font-medium">{formatMoney(r.valueAfter)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                  <td colSpan={8} className="text-right text-sm font-medium pr-4 py-3">Total estimé</td>
                  <td className="text-right tabular-nums font-bold text-sm py-3 pr-4">{formatMoney(totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Truck className="size-4" /> Générer les bons de commande
            </button>
            <p className="text-xs text-zinc-500">
              Les BC seront créés en brouillon, regroupés par fournisseur préféré.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
