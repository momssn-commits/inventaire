import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RefreshCw, Plus, CheckCircle2, Clock, AlertTriangle, ClipboardList } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

async function createCountSheet(formData: FormData) {
  'use server';
  const session = await requireSession();
  const warehouseId = String(formData.get('warehouseId') ?? '');
  if (!warehouseId) redirect('/inventaire?error=missing');

  const reference = await nextSequence('COUNT', 'INV/', 5);

  const lines = await prisma.stockLine.findMany({
    where: {
      location: { warehouseId, type: 'internal' },
      product: { companyId: session.companyId },
    },
    include: { lot: true },
  });

  const sheet = await prisma.countSheet.create({
    data: {
      reference,
      state: 'in_progress',
      scheduledAt: new Date(),
      companyId: session.companyId,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          locationId: l.locationId,
          lotName: l.lot?.name ?? null,
          qtyTheoretical: l.quantity,
          qtyCounted: l.quantity,
          qtyDiff: 0,
        })),
      },
    },
  });

  await logAudit({
    action: 'create', entity: 'countSheet', entityId: sheet.id,
    newValue: { reference, warehouseId, lines: lines.length },
    userId: session.userId, companyId: session.companyId,
  });
  redirect(`/inventaire/${sheet.id}`);
}

const STATE_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="size-4 text-zinc-400" />,
  in_progress: <RefreshCw className="size-4 text-blue-500" />,
  validated: <CheckCircle2 className="size-4 text-green-500" />,
};

export default async function CountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; wh?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const sheets = await prisma.countSheet.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { lines: true } },
      lines: { select: { qtyDiff: true } },
    },
    take: 50,
  });

  // KPIs
  const total = sheets.length;
  const validated = sheets.filter((s) => s.state === 'validated').length;
  const inProgress = sheets.filter((s) => s.state === 'in_progress').length;
  const sheetsWithDiff = sheets.filter((s) =>
    s.lines.some((l) => Math.abs(l.qtyDiff) > 0.001)
  ).length;

  return (
    <div>
      <PageHeader
        title="Inventaire cyclique"
        subtitle="Comptages ponctuels et ajustements automatiques du stock"
        module="M2"
      />

      {sp.error === 'missing' && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          Veuillez sélectionner un site.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-xs text-zinc-500 mt-1">Comptages total</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-blue-600">{inProgress}</div>
          <div className="text-xs text-zinc-500 mt-1">En cours</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-green-600">{validated}</div>
          <div className="text-xs text-zinc-500 mt-1">Validés</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-orange-500">{sheetsWithDiff}</div>
          <div className="text-xs text-zinc-500 mt-1">Avec écarts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des comptages */}
        <div className="lg:col-span-2">
          <div className="card overflow-x-auto">
            {sheets.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="size-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="font-medium text-zinc-600 dark:text-zinc-400">Aucun comptage</p>
                <p className="text-sm text-zinc-400 mt-1">Démarrez votre premier inventaire cyclique.</p>
              </div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th className="text-right">Lignes</th>
                    <th className="text-right">Écarts</th>
                    <th>Démarré</th>
                    <th>Validé</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => {
                    const ecarts = s.lines.filter((l) => Math.abs(l.qtyDiff) > 0.001).length;
                    return (
                      <tr key={s.id} className="group">
                        <td>
                          <Link
                            href={`/inventaire/${s.id}`}
                            className="font-mono text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                          >
                            {s.reference}
                          </Link>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {STATE_ICONS[s.state]}
                            <StatusBadge value={s.state} />
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-sm">{s._count.lines}</td>
                        <td className="text-right tabular-nums text-sm">
                          {ecarts > 0 ? (
                            <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                              <AlertTriangle className="size-3" />
                              {ecarts}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="text-sm text-zinc-500">{formatDate(s.scheduledAt)}</td>
                        <td className="text-sm text-zinc-500">
                          {s.validatedAt ? (
                            <span className="text-green-600 dark:text-green-400">{formatDate(s.validatedAt)}</span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel de lancement */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Plus className="size-4" />
              Nouveau comptage
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Une feuille de comptage est générée à partir du stock théorique actuel.
            </p>
            <form action={createCountSheet} className="space-y-3">
              <div>
                <label className="label">Site à compter *</label>
                <select name="warehouseId" required className="input" defaultValue={sp.wh ?? ''}>
                  <option value="">— Sélectionner —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                <RefreshCw className="size-4" />
                Démarrer le comptage
              </button>
            </form>
          </div>

          <div className="card p-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Comment ça fonctionne ?</p>
            <ol className="space-y-1.5 text-xs list-decimal list-inside">
              <li>Sélectionner le site à inventorier</li>
              <li>Le stock théorique est chargé automatiquement</li>
              <li>L&apos;opérateur saisit les quantités réellement comptées</li>
              <li>Les écarts sont calculés automatiquement</li>
              <li>La validation ajuste le stock en temps réel</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
