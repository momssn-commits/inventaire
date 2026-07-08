import Link from 'next/link';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';
const PER_PAGE = 50;

const ACTION_LABEL: Record<string, string> = {
  create: 'Création', update: 'Modification', delete: 'Suppression', login: 'Connexion', logout: 'Déconnexion',
};
function actionCls(a: string) {
  return a === 'create' ? 'b-ok' : a === 'delete' ? 'b-danger' : a === 'login' || a === 'logout' ? 'b-info' : 'b-warn';
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>;
}) {
  const session = await requireRole(['admin']);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const where = {
    companyId: session.companyId,
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.action ? { action: sp.action } : {}),
  };

  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where: { companyId: session.companyId }, select: { entity: true }, distinct: ['entity'], orderBy: { entity: 'asc' } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const buildUrl = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { entity: sp.entity, action: sp.action, page: sp.page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/audit?${s}` : '/admin/audit';
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Journal d'audit" count={total} subtitle="Historique des actions réalisées dans l'application." />

      <form className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <label className="label">Entité</label>
          <select name="entity" defaultValue={sp.entity ?? ''} className="input">
            <option value="">Toutes</option>
            {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label">Action</label>
          <select name="action" defaultValue={sp.action ?? ''} className="input">
            <option value="">Toutes</option>
            {Object.entries(ACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Filtrer</button>
        {(sp.entity || sp.action) && <Link href="/admin/audit" className="btn-ghost">Réinitialiser</Link>}
      </form>

      <div className="card overflow-x-auto">
        {logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="Aucune entrée" description="Aucune action ne correspond à ces filtres." />
        ) : (
          <table className="table-base">
            <thead>
              <tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détail</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-[13px] whitespace-nowrap" style={{ color: 'rgb(100 116 139)' }}>{formatDateTime(l.createdAt)}</td>
                  <td className="text-[13.5px]">{l.user?.name ?? <span style={{ color: 'rgb(100 116 139)' }}>Système</span>}</td>
                  <td><span className={`badge ${actionCls(l.action)}`}>{ACTION_LABEL[l.action] ?? l.action}</span></td>
                  <td><span className="sku">{l.entity}</span></td>
                  <td className="text-[12.5px] mono max-w-[320px] truncate" style={{ color: 'rgb(100 116 139)' }} title={l.newValue ?? ''}>
                    {l.newValue ? l.newValue.replace(/[{}"]/g, '').slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-[13.5px]" style={{ color: 'rgb(100 116 139)', background: '#fbfcfe', borderTop: '1px solid rgb(232 236 244)' }}>
            <span>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} sur <strong style={{ color: 'rgb(11 18 32)' }}>{total}</strong></span>
            {totalPages > 1 && (
              <div className="flex gap-2">
                {page > 1 ? <Link href={buildUrl({ page: String(page - 1) })} className="btn-ghost p-1.5"><ChevronLeft className="size-4" /></Link> : <button disabled className="btn-ghost p-1.5 opacity-30"><ChevronLeft className="size-4" /></button>}
                <span className="px-2 self-center mono text-xs">{page} / {totalPages}</span>
                {page < totalPages ? <Link href={buildUrl({ page: String(page + 1) })} className="btn-ghost p-1.5"><ChevronRight className="size-4" /></Link> : <button disabled className="btn-ghost p-1.5 opacity-30"><ChevronRight className="size-4" /></button>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
