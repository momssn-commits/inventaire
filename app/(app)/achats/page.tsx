import Link from 'next/link';
import { ShoppingCart, Plus, FileEdit, CheckCircle2, Truck, DollarSign } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    companyId: session.companyId,
    ...(sp.state ? { state: sp.state } : {}),
    ...(sp.q ? {
      OR: [
        { reference: { contains: sp.q } },
        { partner: { name: { contains: sp.q } } },
      ],
    } : {}),
    ...(sp.from || sp.to ? {
      orderedAt: {
        ...(sp.from ? { gte: new Date(sp.from) } : {}),
        ...(sp.to ? { lte: new Date(sp.to) } : {}),
      },
    } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        partner: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.state) params.set('state', sp.state);
    if (sp.from) params.set('from', sp.from);
    if (sp.to) params.set('to', sp.to);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/achats${qs ? `?${qs}` : ''}`;
  };

  // KPIs — requêtes ciblées (pas de findMany plein)
  const [kpiBrouillons, kpiConfirmes, kpiReceptions, kpiValeurAgg] = await Promise.all([
    prisma.purchaseOrder.count({ where: { companyId: session.companyId, state: 'draft' } }),
    prisma.purchaseOrder.count({ where: { companyId: session.companyId, state: { in: ['confirmed', 'sent'] } } }),
    prisma.purchaseOrder.count({ where: { companyId: session.companyId, state: 'received' } }),
    prisma.purchaseOrder.aggregate({ where: { companyId: session.companyId }, _sum: { totalHt: true } }),
  ]);
  const kpiValeur = kpiValeurAgg._sum.totalHt ?? 0;

  return (
    <div>
      <PageHeader
        title="Achats"
        subtitle="Demandes de prix, bons de commande, contrôle des factures"
        module="M7"
        actions={
          <Link href="/achats/nouveau" className="btn-primary">
            <Plus className="size-4" /> Nouveau bon de commande
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Brouillons" value={kpiBrouillons} icon={FileEdit} />
        <KpiCard label="Confirmés" value={kpiConfirmes} icon={CheckCircle2} tone="info" />
        <KpiCard label="En réception" value={kpiReceptions} icon={Truck} tone="warning" />
        <KpiCard label="Valeur totale" value={formatMoney(kpiValeur)} icon={DollarSign} tone="success" />
      </div>

      {/* Filters */}
      <form method="GET" className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Recherche</label>
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Référence ou fournisseur…"
            className="input"
          />
        </div>

        <div className="min-w-44">
          <label className="label">Statut</label>
          <select name="state" defaultValue={sp.state ?? ''} className="input">
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyé</option>
            <option value="confirmed">Confirmé</option>
            <option value="received">Reçu</option>
            <option value="invoiced">Facturé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>

        <div>
          <label className="label">Du</label>
          <input type="date" name="from" defaultValue={sp.from ?? ''} className="input" />
        </div>

        <div>
          <label className="label">Au</label>
          <input type="date" name="to" defaultValue={sp.to ?? ''} className="input" />
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtrer</button>
          <Link href="/achats" className="btn-secondary">Réinitialiser</Link>
        </div>
      </form>

      {/* Table */}
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
                    <Link
                      href={`/achats/${po.id}`}
                      className="text-brand-600 hover:underline font-mono text-xs"
                    >
                      {po.reference}
                    </Link>
                  </td>
                  <td>{po.partner.name}</td>
                  <td>
                    <StatusBadge value={po.state} />
                  </td>
                  <td className="tabular-nums">{po._count.lines}</td>
                  <td className="text-sm">{formatDate(po.orderedAt)}</td>
                  <td className="text-sm">{formatDate(po.expectedAt)}</td>
                  <td className="text-right tabular-nums font-bold">{formatMoney(po.totalHt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
