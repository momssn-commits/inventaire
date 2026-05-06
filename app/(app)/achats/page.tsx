import Link from 'next/link';
import { ShoppingCart, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const session = await requireSession();
  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId: session.companyId },
    include: {
      partner: true,
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <PageHeader
        title="Achats"
        subtitle="Demandes de prix, bons de commande, contrôle des factures"
        module="M7"
        actions={
          <Link href="/achats/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau bon de commande</Link>
        }
      />

      <div className="card overflow-x-auto">
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Aucun bon de commande"
            description="Créez un bon de commande fournisseur ou utilisez le rapport de réassort."
            action={<Link href="/reassort" className="btn-secondary">Voir le réassort</Link>}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Fournisseur</th>
                <th>Statut</th>
                <th>Lignes</th>
                <th>Commandé le</th>
                <th>Prévu le</th>
                <th className="text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link href={`/achats/${po.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                      {po.reference}
                    </Link>
                  </td>
                  <td>{po.partner.name}</td>
                  <td><StatusBadge value={po.state} /></td>
                  <td className="tabular-nums">{po._count.lines}</td>
                  <td className="text-sm">{formatDate(po.orderedAt)}</td>
                  <td className="text-sm">{formatDate(po.expectedAt)}</td>
                  <td className="text-right tabular-nums font-medium">{formatMoney(po.totalHt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
