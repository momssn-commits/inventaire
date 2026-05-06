import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Factory, Plus, Boxes } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

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
  if (bom) {
    for (const op of bom.operations) {
      await prisma.workOrder.create({
        data: {
          moId: mo.id,
          name: op.name,
          durationMin: op.durationMin * qtyToProduce,
          workCenterId: op.workCenterId,
        },
      });
    }
  }
  redirect(`/fabrication/of/${mo.id}`);
}

export default async function ManufacturingPage() {
  const session = await requireSession();
  const mos = await prisma.manufacturingOrder.findMany({
    where: { companyId: session.companyId },
    include: {
      product: true,
      _count: { select: { workOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const boms = await prisma.bom.findMany({
    where: { active: true },
    include: {
      product: true,
      _count: { select: { components: true, operations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const finishedProducts = await prisma.product.findMany({
    where: {
      companyId: session.companyId,
      deletedAt: null,
      boms: { some: { active: true } },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Fabrication"
        subtitle="Nomenclatures (BOM), ordres de fabrication, postes de travail"
        module="M8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold">Ordres de fabrication</h3>
          </div>
          {mos.length === 0 ? (
            <EmptyState icon={Factory} title="Aucun ordre" description="Lancez un ordre de fabrication." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th className="text-right">Quantité</th>
                  <th>Postes</th>
                  <th>Prévu</th>
                </tr>
              </thead>
              <tbody>
                {mos.map((mo) => (
                  <tr key={mo.id}>
                    <td>
                      <Link href={`/fabrication/of/${mo.id}`} className="text-brand-600 hover:underline font-mono text-xs">
                        {mo.reference}
                      </Link>
                    </td>
                    <td className="text-sm">{mo.product.name}</td>
                    <td><StatusBadge value={mo.state} /></td>
                    <td className="text-right tabular-nums">{formatNumber(mo.qtyToProduce, 0)}</td>
                    <td className="tabular-nums text-sm">{mo._count.workOrders}</td>
                    <td className="text-sm">{formatDate(mo.scheduledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Lancer un OF</h3>
          <form action={createMO} className="space-y-3">
            <div>
              <label className="label">Produit à fabriquer *</label>
              <select name="productId" required className="input">
                <option value="">—</option>
                {finishedProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantité *</label>
              <input type="number" min="1" step="1" name="qtyToProduce" required defaultValue="1" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Créer l'OF</button>
            {finishedProducts.length === 0 && (
              <p className="text-xs text-amber-600">
                Aucun produit n'a de nomenclature active. Créez d'abord une BOM.
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Boxes className="size-4" /> Nomenclatures (BOM)</h3>
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
                <th className="text-right">Sortie</th>
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
