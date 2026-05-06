import Link from 'next/link';
import { ArrowLeftRight, Plus, Filter } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  receipt: 'Réception',
  delivery: 'Expédition',
  internal: 'Transfert interne',
  manufacturing: 'Fabrication',
  return: 'Retour',
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; state?: string; q?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const pickings = await prisma.picking.findMany({
    where: {
      companyId: session.companyId,
      ...(sp.type ? { type: sp.type } : {}),
      ...(sp.state ? { state: sp.state } : {}),
      ...(sp.q
        ? {
            OR: [
              { reference: { contains: sp.q } },
              { origin: { contains: sp.q } },
            ],
          }
        : {}),
    },
    include: {
      partner: true,
      fromWarehouse: true,
      toWarehouse: true,
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Mouvements de stock"
        subtitle="Réceptions, expéditions, transferts internes et retours"
        module="M3"
        actions={
          <Link href="/operations/nouveau" className="btn-primary">
            <Plus className="size-4" /> Nouveau mouvement
          </Link>
        }
      />

      <div className="card p-3 mb-3">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Recherche</label>
            <input name="q" defaultValue={sp.q ?? ''} className="input" placeholder="Référence, origine…" />
          </div>
          <div className="min-w-[160px]">
            <label className="label">Type</label>
            <select name="type" defaultValue={sp.type ?? ''} className="input">
              <option value="">Tous</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
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
          <button type="submit" className="btn-secondary"><Filter className="size-4" /> Filtrer</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        {pickings.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Aucun mouvement"
            description="Créez un mouvement de réception, expédition ou transfert."
            action={<Link href="/operations/nouveau" className="btn-primary"><Plus className="size-4" /> Nouveau mouvement</Link>}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Type</th>
                <th>Partenaire</th>
                <th>Source → Destination</th>
                <th>Lignes</th>
                <th>Prévu le</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {pickings.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/operations/${p.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                      {p.reference}
                    </Link>
                  </td>
                  <td className="text-xs">{TYPE_LABEL[p.type] ?? p.type}</td>
                  <td className="text-sm">{p.partner?.name ?? '—'}</td>
                  <td className="text-xs text-zinc-600 dark:text-zinc-400">
                    {p.fromWarehouse?.code ?? '—'} → {p.toWarehouse?.code ?? '—'}
                  </td>
                  <td className="tabular-nums text-sm">{p._count.lines}</td>
                  <td className="text-sm">{formatDate(p.scheduledAt)}</td>
                  <td><StatusBadge value={p.state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
