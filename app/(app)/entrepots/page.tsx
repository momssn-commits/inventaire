import Link from 'next/link';
import { Plus, Warehouse, MapPin } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createWarehouse(formData: FormData) {
  'use server';
  const session = await requireRole(['admin', 'manager']);
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  if (!code || !name) redirect('/entrepots?error=missing');

  const wh = await prisma.warehouse.create({
    data: {
      code,
      name,
      city: String(formData.get('city') ?? '') || null,
      address: String(formData.get('address') ?? '') || null,
      managerName: String(formData.get('managerName') ?? '') || null,
      receptionSteps: Number(formData.get('receptionSteps') ?? 1),
      deliverySteps: Number(formData.get('deliverySteps') ?? 1),
      companyId: session.companyId,
    },
  });
  // Création des emplacements par défaut
  await prisma.location.createMany({
    data: [
      { name: 'Stock', fullPath: `${code}/Stock`, type: 'view', warehouseId: wh.id },
      { name: 'Quai réception', fullPath: `${code}/Réception`, type: 'internal', warehouseId: wh.id },
      { name: 'Quai expédition', fullPath: `${code}/Expédition`, type: 'internal', warehouseId: wh.id },
      { name: 'Rebut', fullPath: `${code}/Rebut`, type: 'scrap', warehouseId: wh.id },
    ],
  });
  redirect('/entrepots');
}

export default async function WarehousesPage() {
  const session = await requireSession();
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    include: {
      locations: { where: { type: 'internal' } },
      _count: { select: { locations: true } },
    },
    orderBy: { code: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Entrepôts"
        subtitle="Sites de stockage, emplacements et structure interne"
        module="M2"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {warehouses.length === 0 ? (
            <div className="card">
              <EmptyState icon={Warehouse} title="Aucun entrepôt" description="Créez votre premier entrepôt." />
            </div>
          ) : (
            warehouses.map((wh) => (
              <div key={wh.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{wh.name}</h3>
                      <span className="badge bg-zinc-100 dark:bg-zinc-800 font-mono">{wh.code}</span>
                    </div>
                    {wh.address && (
                      <p className="text-sm text-zinc-500 mt-1">
                        <MapPin className="size-3 inline mr-1" />
                        {wh.address}{wh.city ? `, ${wh.city}` : ''}
                      </p>
                    )}
                    {wh.managerName && (
                      <p className="text-xs text-zinc-500 mt-1">Responsable : {wh.managerName}</p>
                    )}
                  </div>
                  <Link href={`/emplacements?wh=${wh.id}`} className="btn-secondary text-sm">
                    Emplacements
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">Emplacements</div>
                    <div className="font-medium tabular-nums">{wh._count.locations}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Étapes réception</div>
                    <div className="font-medium">{wh.receptionSteps}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Étapes expédition</div>
                    <div className="font-medium">{wh.deliverySteps}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvel entrepôt</h3>
          <form action={createWarehouse} className="space-y-3">
            <div>
              <label className="label">Code (3-5 car.) *</label>
              <input name="code" required className="input" maxLength={5} placeholder="WH3" />
            </div>
            <div>
              <label className="label">Dénomination *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input name="address" className="input" />
            </div>
            <div>
              <label className="label">Ville</label>
              <input name="city" className="input" />
            </div>
            <div>
              <label className="label">Responsable</label>
              <input name="managerName" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Étapes réception</label>
                <select name="receptionSteps" className="input" defaultValue="1">
                  <option value="1">1 étape</option>
                  <option value="2">2 étapes</option>
                  <option value="3">3 étapes</option>
                </select>
              </div>
              <div>
                <label className="label">Étapes expédition</label>
                <select name="deliverySteps" className="input" defaultValue="1">
                  <option value="1">1 étape</option>
                  <option value="2">2 étapes</option>
                  <option value="3">3 étapes</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">Créer l'entrepôt</button>
          </form>
        </div>
      </div>
    </div>
  );
}
