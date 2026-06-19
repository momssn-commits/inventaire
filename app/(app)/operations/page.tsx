import Link from 'next/link';
import { Truck, Plus, PackageCheck, PackageMinus, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

const TYPES: Record<string, { label: string; color: string }> = {
  receipt:       { label: 'Réception',        color: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400' },
  delivery:      { label: 'Expédition',        color: 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' },
  internal:      { label: 'Transfert interne', color: 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400' },
  manufacturing: { label: 'Fabrication',       color: 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' },
  return:        { label: 'Retour',            color: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400' },
};


export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; state?: string; q?: string; page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    companyId: session.companyId,
    ...(sp.type ? { type: sp.type } : {}),
    ...(sp.state ? { state: sp.state } : {}),
    ...(sp.q
      ? { OR: [{ reference: { contains: sp.q } }, { origin: { contains: sp.q } }] }
      : {}),
  };

  const [pickings, total, kpiReceipt, kpiDelivery, kpiInternal, kpiInProgress] = await Promise.all([
    prisma.picking.findMany({
      where,
      include: {
        partner: true,
        fromWarehouse: true,
        toWarehouse: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.picking.count({ where }),
    prisma.picking.count({ where: { companyId: session.companyId, type: 'receipt' } }),
    prisma.picking.count({ where: { companyId: session.companyId, type: 'delivery' } }),
    prisma.picking.count({ where: { companyId: session.companyId, type: 'internal' } }),
    prisma.picking.count({ where: { companyId: session.companyId, state: { in: ['confirmed', 'assigned'] } } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const kpis = { receipt: kpiReceipt, delivery: kpiDelivery, internal: kpiInternal, inProgress: kpiInProgress };

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.type) params.set('type', sp.type);
    if (sp.state) params.set('state', sp.state);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/operations${qs ? `?${qs}` : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="Mouvements de stock"
        subtitle="Réceptions, expéditions, transferts internes et retours"
        module="M3"
        actions={
          <Link href="/operations/nouveau" className="btn-primary flex items-center gap-2">
            <Plus className="size-4" /> Nouveau mouvement
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Réceptions" value={kpis.receipt} icon={PackageCheck} tone="success" />
        <KpiCard label="Expéditions" value={kpis.delivery} icon={PackageMinus} tone="info" />
        <KpiCard label="Transferts" value={kpis.internal} icon={ArrowLeftRight} />
        <KpiCard label="En attente" value={kpis.inProgress} icon={Truck} tone="warning" />
      </div>

      {/* Filtres */}
      <div className="card p-4 mb-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Recherche</label>
            <input name="q" defaultValue={sp.q ?? ''} className="input" placeholder="Référence, origine…" />
          </div>
          <div className="min-w-[160px]">
            <label className="label">Type</label>
            <select name="type" defaultValue={sp.type ?? ''} className="input">
              <option value="">Tous les types</option>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="label">Statut</label>
            <select name="state" defaultValue={sp.state ?? ''} className="input">
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="confirmed">Confirmé</option>
              <option value="assigned">Affecté</option>
              <option value="done">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
          <button type="submit" className="btn-secondary">Filtrer</button>
          {(sp.q || sp.type || sp.state) && (
            <Link href="/operations" className="btn-ghost text-sm">Réinitialiser</Link>
          )}
        </form>
      </div>

      {/* Tableau */}
      <div className="card overflow-x-auto">
        {pickings.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="size-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="font-medium text-zinc-600 dark:text-zinc-400">Aucun mouvement trouvé</p>
            <p className="text-sm text-zinc-400 mt-1">Créez une réception, une expédition ou un transfert.</p>
            <Link href="/operations/nouveau" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="size-4" /> Nouveau mouvement
            </Link>
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Type</th>
                <th>Partenaire</th>
                <th>Flux</th>
                <th className="text-right">Lignes</th>
                <th>Prévu le</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pickings.map((p) => {
                const typeInfo = TYPES[p.type];
                return (
                  <tr key={p.id} className="group">
                    <td>
                      <Link href={`/operations/${p.id}`} className="font-mono text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                        {p.reference}
                      </Link>
                      {p.origin && (
                        <div className="text-[10px] text-zinc-400 mt-0.5">{p.origin}</div>
                      )}
                    </td>
                    <td>
                      {typeInfo && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-zinc-700 dark:text-zinc-300">
                      {p.partner?.name ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <span>{p.fromWarehouse?.code ?? '—'}</span>
                        <ChevronRight className="size-3" />
                        <span>{p.toWarehouse?.code ?? '—'}</span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-sm">{p._count.lines}</td>
                    <td className="text-sm text-zinc-500">{formatDate(p.scheduledAt)}</td>
                    <td><StatusBadge value={p.state} /></td>
                    <td>
                      <Link href={`/operations/${p.id}`} className="opacity-0 group-hover:opacity-100 text-xs text-brand-600 hover:underline transition-opacity">
                        Voir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
