import Link from 'next/link';
import { Plus, Warehouse, MapPin, User, ArrowRight, Building2, PackageCheck, Truck } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

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
  await prisma.location.createMany({
    data: [
      { name: 'Stock', fullPath: `${code}/Stock`, type: 'view', warehouseId: wh.id },
      { name: 'Réception', fullPath: `${code}/Réception`, type: 'internal', warehouseId: wh.id },
      { name: 'Expédition', fullPath: `${code}/Expédition`, type: 'internal', warehouseId: wh.id },
      { name: 'Rebut', fullPath: `${code}/Rebut`, type: 'scrap', warehouseId: wh.id },
    ],
  });
  redirect('/entrepots');
}

export default async function WarehousesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    include: {
      _count: { select: { locations: true } },
      locations: {
        where: { type: 'internal' },
        select: { id: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  const warehouseIds = warehouses.map((w) => w.id);
  const stockGroups = await prisma.stockLine.groupBy({
    by: ['locationId'],
    where: { location: { warehouseId: { in: warehouseIds } } },
    _sum: { quantity: true },
  });
  const locationsForStock = await prisma.location.findMany({
    where: { warehouseId: { in: warehouseIds } },
    select: { id: true, warehouseId: true },
  });
  const locWhMap = Object.fromEntries(locationsForStock.map((l) => [l.id, l.warehouseId]));
  const stockMap: Record<string, number> = {};
  for (const g of stockGroups) {
    const whId = locWhMap[g.locationId];
    if (whId) stockMap[whId] = (stockMap[whId] ?? 0) + (g._sum.quantity ?? 0);
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        subtitle={`${warehouses.length} site${warehouses.length !== 1 ? 's' : ''} de stockage`}
        module="M2"
      />

      {sp.error === 'missing' && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          Code et dénomination obligatoires.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des sites */}
        <div className="lg:col-span-2 space-y-4">
          {warehouses.length === 0 ? (
            <div className="card p-12 text-center">
              <Warehouse className="size-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="font-medium text-zinc-600 dark:text-zinc-400">Aucun site</p>
              <p className="text-sm text-zinc-400 mt-1">Créez votre premier site de stockage.</p>
            </div>
          ) : (
            warehouses.map((wh) => (
              <div key={wh.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 grid place-items-center shrink-0">
                      <Building2 className="size-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{wh.name}</h3>
                        <span className="badge bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">{wh.code}</span>
                      </div>
                      {(wh.address || wh.city) && (
                        <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="size-3" />
                          {[wh.address, wh.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {wh.managerName && (
                        <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                          <User className="size-3" />
                          {wh.managerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/emplacements?wh=${wh.id}`}
                    className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
                  >
                    Locaux
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500 mb-1">Locaux</div>
                    <div className="font-semibold tabular-nums">{wh._count.locations}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500 mb-1">Unités en stock</div>
                    <div className="font-semibold tabular-nums">
                      {(stockMap[wh.id] ?? 0).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <PackageCheck className="size-3" /> Réception
                    </div>
                    <div className="font-semibold">{wh.receptionSteps} étape{wh.receptionSteps > 1 ? 's' : ''}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <Truck className="size-3" /> Expédition
                    </div>
                    <div className="font-semibold">{wh.deliverySteps} étape{wh.deliverySteps > 1 ? 's' : ''}</div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 text-xs">
                  <Link href={`/inventaire?wh=${wh.id}`} className="text-zinc-500 hover:text-brand-600 transition">
                    → Lancer un comptage
                  </Link>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <Link href={`/operations?wh=${wh.id}`} className="text-zinc-500 hover:text-brand-600 transition">
                    → Voir les mouvements
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Formulaire de création */}
        <div>
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" />
              Nouveau site
            </h3>
            <form action={createWarehouse} className="space-y-3">
              <div>
                <label className="label">Code (3–5 car.) *</label>
                <input name="code" required className="input uppercase" maxLength={5} placeholder="WH1" />
              </div>
              <div>
                <label className="label">Dénomination *</label>
                <input name="name" required className="input" placeholder="Site central" />
              </div>
              <div>
                <label className="label">Adresse</label>
                <input name="address" className="input" placeholder="12 rue de la Logistique" />
              </div>
              <div>
                <label className="label">Ville</label>
                <input name="city" className="input" placeholder="Paris" />
              </div>
              <div>
                <label className="label">Responsable</label>
                <input name="managerName" className="input" placeholder="Nom du responsable" />
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
              <button type="submit" className="btn-primary w-full">
                Créer le site
              </button>
            </form>
          </div>

          <div className="card p-4 mt-4 text-sm text-zinc-500">
            <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Locaux créés automatiquement</p>
            <ul className="space-y-1 text-xs">
              <li>• <span className="font-mono">CODE/Stock</span> — Vue principale</li>
              <li>• <span className="font-mono">CODE/Réception</span> — Quai entrant</li>
              <li>• <span className="font-mono">CODE/Expédition</span> — Quai sortant</li>
              <li>• <span className="font-mono">CODE/Rebut</span> — Zone rebut</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
