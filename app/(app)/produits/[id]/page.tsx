import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Tag, MapPin, History, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatMoney, formatNumber, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      category: true,
      uomStock: true,
      uomPurchase: true,
      uomSale: true,
      preferredSupplier: true,
      stockLines: {
        include: { location: { include: { warehouse: true } }, lot: true },
        orderBy: { quantity: 'desc' },
      },
      lots: { orderBy: { createdAt: 'desc' } },
      packagings: true,
    },
  });
  if (!product) notFound();

  const onHand = product.stockLines
    .filter((l) => l.location.type === 'internal')
    .reduce((s, l) => s + l.quantity, 0);
  const reserved = product.stockLines.reduce((s, l) => s + l.reserved, 0);
  const stockValue = product.stockLines
    .filter((l) => l.location.type === 'internal')
    .reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const lowStock = product.minQty > 0 && onHand < product.minQty;

  // Mouvements récents
  const recentLines = await prisma.pickingLine.findMany({
    where: { productId: product.id, picking: { state: 'done' } },
    orderBy: { picking: { doneAt: 'desc' } },
    take: 10,
    include: { picking: true, fromLocation: true, toLocation: true },
  });

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={`SKU: ${product.sku}${product.barcode ? ` • Code-barres: ${product.barcode}` : ''}`}
        module="M1"
        actions={
          <>
            <Link href="/produits" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>
          </>
        }
      />

      {lowStock && (
        <div className="mb-4 card p-4 border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-200">Stock sous le seuil</div>
              <div className="text-sm text-amber-800 dark:text-amber-300">
                Disponible : {formatNumber(onHand, 0)} {product.uomStock.symbol} • Minimum : {formatNumber(product.minQty, 0)}
              </div>
            </div>
            <Link href="/reassort" className="ml-auto btn-primary">Réassort</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Disponible</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">
            {formatNumber(onHand, 0)} <span className="text-base text-zinc-500">{product.uomStock.symbol}</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Réservé</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatNumber(reserved, 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Valeur stock</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatMoney(stockValue)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">Coût unitaire</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatMoney(product.cost)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Caractéristiques</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Type</dt>
              <dd className="font-medium capitalize">
                {product.type === 'storable' ? 'Stockable' : product.type === 'consumable' ? 'Consommable' : 'Service'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Suivi</dt>
              <dd className="font-medium">
                {product.tracking === 'serial' ? 'Numéro de série' : product.tracking === 'lot' ? 'Par lot' : 'Aucun'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Catégorie</dt>
              <dd className="font-medium">{product.category?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Unité de stock</dt>
              <dd className="font-medium">{product.uomStock.name} ({product.uomStock.symbol})</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Valorisation</dt>
              <dd className="font-medium uppercase">{product.costingMethod}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Facturation</dt>
              <dd className="font-medium">{product.invoicePolicy === 'order' ? 'À la commande' : 'À la livraison'}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Achat & vente</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Prix de vente HT</dt>
              <dd className="font-medium tabular-nums">{formatMoney(product.salePrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Coût d'achat</dt>
              <dd className="font-medium tabular-nums">{formatMoney(product.cost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Marge théorique</dt>
              <dd className="font-medium tabular-nums">
                {product.salePrice > 0
                  ? `${(((product.salePrice - product.cost) / product.salePrice) * 100).toFixed(1)} %`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Fournisseur préféré</dt>
              <dd className="font-medium truncate">{product.preferredSupplier?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Délai d'appro.</dt>
              <dd className="font-medium">{product.leadTimeDays} j</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Réassort</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Stock min.</dt>
              <dd className="font-medium tabular-nums">{formatNumber(product.minQty, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Stock max.</dt>
              <dd className="font-medium tabular-nums">{formatNumber(product.maxQty, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Quantité multiple</dt>
              <dd className="font-medium tabular-nums">{formatNumber(product.reorderQty, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Délai sécurité</dt>
              <dd className="font-medium">{product.safetyDays} j</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <MapPin className="size-4" /> Stock par emplacement
        </h3>
        {product.stockLines.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun stock enregistré pour ce produit.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Entrepôt</th>
                <th>Emplacement</th>
                <th>Lot / N° série</th>
                <th className="text-right">Quantité</th>
                <th className="text-right">Coût unit.</th>
                <th className="text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {product.stockLines.map((l) => (
                <tr key={l.id}>
                  <td className="text-sm">{l.location.warehouse?.name ?? <span className="text-zinc-400 italic">virtuel</span>}</td>
                  <td className="text-sm font-mono text-xs">{l.location.fullPath}</td>
                  <td className="text-sm font-mono text-xs">{l.lot?.name ?? '—'}</td>
                  <td className="text-right tabular-nums">{formatNumber(l.quantity, 0)}</td>
                  <td className="text-right tabular-nums text-sm text-zinc-500">{formatMoney(l.unitCost)}</td>
                  <td className="text-right tabular-nums font-medium">{formatMoney(l.quantity * l.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {product.lots.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Tag className="size-4" /> {product.tracking === 'serial' ? 'Actifs individuels (N° série)' : 'Lots'}
            <span className="ml-auto text-sm font-normal text-zinc-500">{product.lots.length} actifs</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{product.tracking === 'serial' ? 'N° série' : 'Lot'}</th>
                  <th>État</th>
                  <th>Marque</th>
                  <th>Spécifications</th>
                  <th>Service</th>
                  <th>Péremption</th>
                </tr>
              </thead>
              <tbody>
                {product.lots.slice(0, 200).map((lot) => (
                  <tr key={lot.id}>
                    <td className="font-mono text-xs">
                      <a href={`/tracabilite?q=${encodeURIComponent(lot.name)}`} className="text-brand-600 hover:underline">
                        {lot.name}
                      </a>
                    </td>
                    <td className="text-xs">
                      {lot.condition && (
                        <span
                          className={`badge text-[11px] ${
                            lot.condition === 'BON ETAT'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : lot.condition === 'MAUVAIS ETAT'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          }`}
                        >
                          {lot.condition}
                        </span>
                      )}
                    </td>
                    <td className="text-xs">{lot.brand ?? '—'}</td>
                    <td className="text-xs text-zinc-500 truncate max-w-[200px]">{lot.specifications ?? '—'}</td>
                    <td className="text-xs">{lot.serviceName ?? '—'}</td>
                    <td className="text-xs">{formatDate(lot.expirationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {product.lots.length > 200 && (
              <div className="p-3 text-xs text-zinc-500 text-center">
                {product.lots.length - 200} actifs supplémentaires non affichés.
              </div>
            )}
          </div>
        </div>
      )}

      {recentLines.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <History className="size-4" /> Historique des mouvements (10 derniers)
          </h3>
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Type</th>
                <th>De</th>
                <th>Vers</th>
                <th className="text-right">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {recentLines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/operations/${l.picking.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                      {l.picking.reference}
                    </Link>
                  </td>
                  <td className="text-sm">{formatDate(l.picking.doneAt)}</td>
                  <td className="text-xs capitalize">{l.picking.type}</td>
                  <td className="text-xs">{l.fromLocation?.name ?? '—'}</td>
                  <td className="text-xs">{l.toLocation?.name ?? '—'}</td>
                  <td className="text-right tabular-nums">{formatNumber(l.qtyDone, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
