import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Factory, Plus, Boxes, Cog, CheckCircle2, Timer, Layers } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

async function createMO(formData: FormData) {
  'use server';
  const session = await requireSession();
  const productId = String(formData.get('productId') ?? '');
  const qtyToProduce = Number(formData.get('qtyToProduce') ?? 1);
  if (!productId || qtyToProduce <= 0) redirect('/fabrication?error=missing');

  const reference = await nextSequence('MO', 'MO', 5);
  const mo = await prisma.manufacturingOrder.create({
    data: {
      reference,
      state: 'confirmed',
      qtyToProduce,
      productId,
      scheduledAt: new Date(),
      companyId: session.companyId,
    },
  });

  // Créer les ordres de travail à partir de la BOM
  const bom = await prisma.bom.findFirst({
    where: { productId, active: true },
    include: { operations: { include: { workCenter: true } } },
  });
  if (bom?.operations.length) {
    await prisma.workOrder.createMany({
      data: bom.operations.map((op) => ({
        moId: mo.id,
        name: op.name,
        durationMin: op.durationMin * qtyToProduce,
        workCenterId: op.workCenterId,
      })),
    });
  }
  redirect(`/fabrication/of/${mo.id}`);
}

export default async function ManufacturingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const [mos, total, boms, finishedProducts, workCenterCount] = await Promise.all([
    prisma.manufacturingOrder.findMany({
      where: { companyId: session.companyId },
      include: {
        product: true,
        _count: { select: { workOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.manufacturingOrder.count({ where: { companyId: session.companyId } }),
    prisma.bom.findMany({
      where: { active: true },
      include: {
        product: true,
        _count: { select: { components: true, operations: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.findMany({
      where: {
        companyId: session.companyId,
        deletedAt: null,
        boms: { some: { active: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.workCenter.count({ where: { active: true } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const buildHref = (p: number) => `/fabrication${p > 1 ? `?page=${p}` : ''}`;

  // KPIs sur l'ensemble (pas seulement la page)
  const [kpiEnCours, kpiTermines] = await Promise.all([
    prisma.manufacturingOrder.count({ where: { companyId: session.companyId, state: { in: ['confirmed', 'in_progress'] } } }),
    prisma.manufacturingOrder.count({ where: { companyId: session.companyId, state: 'done' } }),
  ]);
  const kpiBoms = boms.length;

  return (
    <div>
      <PageHeader
        title="Fabrication"
        subtitle="Nomenclatures (BOM), ordres de fabrication, postes de travail"
        module="M8"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ordres en cours" value={kpiEnCours} icon={Timer} tone="info" />
        <KpiCard label="Terminés" value={kpiTermines} icon={CheckCircle2} tone="success" />
        <KpiCard label="Nomenclatures actives" value={kpiBoms} icon={Layers} />
        <KpiCard label="Postes de travail" value={workCenterCount} icon={Cog} tone="warning" />
      </div>

      {/* OF table + launch form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Left: OF table */}
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Factory className="size-4" /> Ordres de fabrication
            </h3>
          </div>
          {mos.length === 0 ? (
            <EmptyState
              icon={Factory}
              title="Aucun ordre"
              description="Lancez un ordre de fabrication."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th className="text-right">Qté à produire</th>
                  <th>Qté produite</th>
                  <th>Prévu le</th>
                </tr>
              </thead>
              <tbody>
                {mos.map((mo) => {
                  const qtyDone = (mo as unknown as { qtyProduced?: number }).qtyProduced ?? 0;
                  const pct =
                    mo.qtyToProduce > 0 ? Math.min(100, (qtyDone / mo.qtyToProduce) * 100) : 0;
                  return (
                    <tr key={mo.id}>
                      <td>
                        <Link
                          href={`/fabrication/of/${mo.id}`}
                          className="text-brand-600 hover:underline font-mono text-xs"
                        >
                          {mo.reference}
                        </Link>
                      </td>
                      <td className="text-sm">{mo.product.name}</td>
                      <td>
                        <StatusBadge value={mo.state} />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatNumber(mo.qtyToProduce, 0)}
                      </td>
                      <td className="tabular-nums text-sm min-w-32">
                        {qtyDone > 0 ? (
                          <div className="flex items-center gap-2">
                            <span>{formatNumber(qtyDone, 0)}</span>
                            <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-sm">{formatDate(mo.scheduledAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: launch form */}
        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Plus className="size-4" /> Lancer un OF
          </h3>
          <form action={createMO} className="space-y-3">
            <div>
              <label className="label">Produit à fabriquer *</label>
              <select name="productId" required className="input">
                <option value="">—</option>
                {finishedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantité *</label>
              <input
                type="number"
                min="1"
                step="1"
                name="qtyToProduce"
                required
                defaultValue="1"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Créer l'OF
            </button>
            {finishedProducts.length === 0 && (
              <p className="text-xs text-amber-600">
                Aucun produit n'a de nomenclature active. Créez d'abord une BOM.
              </p>
            )}
          </form>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />

      {/* BOM section */}
      <div className="card overflow-x-auto">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Boxes className="size-4" /> Nomenclatures (BOM)
          </h3>
        </div>
        {boms.length === 0 ? (
          <EmptyState icon={Boxes} title="Aucune nomenclature" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Produit fini</th>
                <th>Version</th>
                <th className="text-right">Qtés sortie</th>
                <th>Composants</th>
                <th>Opérations</th>
              </tr>
            </thead>
            <tbody>
              {boms.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.reference}</td>
                  <td>{b.product.name}</td>
                  <td>v{b.version}</td>
                  <td className="text-right tabular-nums">{formatNumber(b.qtyOutput, 0)}</td>
                  <td className="tabular-nums">{b._count.components}</td>
                  <td className="tabular-nums">{b._count.operations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
