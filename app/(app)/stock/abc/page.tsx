import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { formatNumber, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { getAbcClassification } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export default async function AbcPage() {
  const session = await requireSession();
  const classification = await getAbcClassification(session.companyId);

  const totalValue = classification.reduce((s, r) => s + r.value, 0);
  const a = classification.filter((r) => r.abc === 'A');
  const b = classification.filter((r) => r.abc === 'B');
  const c = classification.filter((r) => r.abc === 'C');
  const aValue = a.reduce((s, r) => s + r.value, 0);
  const bValue = b.reduce((s, r) => s + r.value, 0);
  const cValue = c.reduce((s, r) => s + r.value, 0);

  return (
    <div>
      <PageHeader
        title="Analyse ABC du stock"
        subtitle="Classification de Pareto par valeur cumulée — A : 80 % de la valeur, B : 80–95 %, C : 95–100 %"
        module="Stock"
        actions={<Link href="/stock" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      {classification.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="Pas assez de données"
            description="Ajoutez des produits avec un coût et du stock pour voir la classification ABC."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-5 border-l-4 border-l-emerald-500">
              <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Classe A</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{a.length}</span>
                <span className="text-sm text-zinc-500">produits</span>
              </div>
              <div className="mt-1 text-sm">
                <span className="font-medium tabular-nums">{formatMoney(aValue)}</span>
                <span className="text-zinc-500 ml-2">
                  ({totalValue > 0 ? ((aValue / totalValue) * 100).toFixed(1) : '0'} % de la valeur)
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Suivi prioritaire — comptage cyclique fréquent recommandé.
              </div>
            </div>
            <div className="card p-5 border-l-4 border-l-amber-500">
              <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Classe B</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{b.length}</span>
                <span className="text-sm text-zinc-500">produits</span>
              </div>
              <div className="mt-1 text-sm">
                <span className="font-medium tabular-nums">{formatMoney(bValue)}</span>
                <span className="text-zinc-500 ml-2">
                  ({totalValue > 0 ? ((bValue / totalValue) * 100).toFixed(1) : '0'} %)
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Suivi standard.</div>
            </div>
            <div className="card p-5 border-l-4 border-l-zinc-400">
              <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Classe C</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{c.length}</span>
                <span className="text-sm text-zinc-500">produits</span>
              </div>
              <div className="mt-1 text-sm">
                <span className="font-medium tabular-nums">{formatMoney(cValue)}</span>
                <span className="text-zinc-500 ml-2">
                  ({totalValue > 0 ? ((cValue / totalValue) * 100).toFixed(1) : '0'} %)
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Comptage allégé.</div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Classe</th>
                  <th>SKU</th>
                  <th>Produit</th>
                  <th className="text-right">Quantité</th>
                  <th className="text-right">Valeur</th>
                  <th className="text-right">Part</th>
                  <th className="text-right">Cumul</th>
                </tr>
              </thead>
              <tbody>
                {classification.slice(0, 200).map((r, i) => (
                  <tr key={r.product.id}>
                    <td className="text-xs text-zinc-500 tabular-nums">{i + 1}</td>
                    <td>
                      <span className={`badge text-xs ${
                        r.abc === 'A' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : r.abc === 'B' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {r.abc}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{r.product.sku}</td>
                    <td>
                      <Link href={`/produits/${r.product.id}`} className="text-brand-600 hover:underline">
                        {r.product.name}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(r.qty, 0)}</td>
                    <td className="text-right tabular-nums font-medium">{formatMoney(r.value)}</td>
                    <td className="text-right tabular-nums text-sm text-zinc-500">{r.share.toFixed(2)} %</td>
                    <td className="text-right tabular-nums text-sm text-zinc-500">{r.cumulShare.toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {classification.length > 200 && (
              <div className="p-3 text-xs text-zinc-500 text-center">
                {classification.length - 200} produits supplémentaires non affichés.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
