import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Plus, Tag, ChevronRight, Package } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, requireRole, logAudit } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  internal: { label: 'Interne', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  view: { label: 'Vue', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  supplier: { label: 'Fournisseur', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  customer: { label: 'Client', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  transit: { label: 'Transit', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  inventory: { label: 'Inventaire', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  production: { label: 'Production', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  scrap: { label: 'Rebut', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

async function createLocation(formData: FormData) {
  'use server';
  const session = await requireRole(['admin', 'manager']);
  const name = String(formData.get('name') ?? '').trim();
  const warehouseId = String(formData.get('warehouseId') ?? '') || null;
  const parentId = String(formData.get('parentId') ?? '') || null;
  const type = String(formData.get('type') ?? 'internal');
  const barcode = String(formData.get('barcode') ?? '') || null;

  if (!name) redirect('/emplacements?error=missing');

  let fullPath = name;
  if (parentId) {
    const parent = await prisma.location.findUnique({ where: { id: parentId } });
    if (parent) fullPath = `${parent.fullPath}/${name}`;
  } else if (warehouseId) {
    const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (wh) fullPath = `${wh.code}/${name}`;
  }

  const created = await prisma.location.create({
    data: { name, fullPath, type, warehouseId, parentId, barcode },
  });
  await logAudit({
    action: 'create', entity: 'location', entityId: created.id,
    newValue: { name, fullPath, type, warehouseId },
    userId: session.userId, companyId: session.companyId,
  });
  const whParam = warehouseId ? `?wh=${warehouseId}` : '';
  redirect(`/emplacements${whParam}`);
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string; type?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: { code: 'asc' },
  });

  const locations = await prisma.location.findMany({
    where: {
      ...(sp.wh
        ? { warehouseId: sp.wh, warehouse: { companyId: session.companyId } }
        : { warehouse: { companyId: session.companyId } }),
      ...(sp.type ? { type: sp.type } : {}),
    },
    include: {
      warehouse: true,
      parent: true,
      _count: { select: { stockLinesIn: true, children: true } },
    },
    orderBy: { fullPath: 'asc' },
  });

  const selectedWarehouse = sp.wh ? warehouses.find((w) => w.id === sp.wh) : null;

  // Statistiques par type
  const countByType = locations.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Locaux"
        subtitle={
          selectedWarehouse
            ? `${selectedWarehouse.name} — ${locations.length} loca${locations.length !== 1 ? 'ux' : 'l'}`
            : `${locations.length} loca${locations.length !== 1 ? 'ux' : 'l'} au total`
        }
        module="M2"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Filtres */}
          <div className="card p-4">
            <form className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="label">Site</label>
                <select name="wh" defaultValue={sp.wh ?? ''} className="input">
                  <option value="">Tous les sites</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="label">Type</label>
                <select name="type" defaultValue={sp.type ?? ''} className="input">
                  <option value="">Tous les types</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary">Filtrer</button>
              {(sp.wh || sp.type) && (
                <Link href="/emplacements" className="btn-ghost text-sm">Réinitialiser</Link>
              )}
            </form>
          </div>

          {/* Résumé par type */}
          {Object.keys(countByType).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(countByType).map(([type, count]) => {
                const info = TYPE_LABELS[type] ?? { label: type, color: 'bg-zinc-100 text-zinc-600' };
                return (
                  <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.color}`}>
                    {info.label}
                    <span className="font-mono font-semibold">{count}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="card overflow-x-auto">
            {locations.length === 0 ? (
              <div className="p-12 text-center">
                <MapPin className="size-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="text-zinc-500">Aucun local trouvé.</p>
              </div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Chemin complet</th>
                    <th>Type</th>
                    <th>Site</th>
                    <th>Code-barres</th>
                    <th className="text-right">Lignes stock</th>
                    <th className="text-right">Sous-empl.</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => {
                    const parts = l.fullPath.split('/');
                    const info = TYPE_LABELS[l.type] ?? { label: l.type, color: 'bg-zinc-100 text-zinc-600' };
                    return (
                      <tr key={l.id} className="group">
                        <td>
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            {parts.map((p, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="size-3 text-zinc-300" />}
                                <span className={i === parts.length - 1 ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-400'}>
                                  {p}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${info.color}`}>
                            {info.label}
                          </span>
                        </td>
                        <td className="text-sm text-zinc-600 dark:text-zinc-400">
                          {l.warehouse?.name ?? <span className="italic text-zinc-400">Virtuel</span>}
                        </td>
                        <td>
                          {l.barcode && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">
                              <Tag className="size-2.5" />
                              {l.barcode}
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-sm">
                          {l._count.stockLinesIn > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-zinc-700 dark:text-zinc-300">
                              <Package className="size-3 text-zinc-400" />
                              {l._count.stockLinesIn}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-sm text-zinc-500">
                          {l._count.children > 0 ? l._count.children : <span className="text-zinc-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" />
              Nouveau local
            </h3>
            <form action={createLocation} className="space-y-3">
              <div>
                <label className="label">Nom *</label>
                <input name="name" required className="input" placeholder="Casier-A7" />
              </div>
              <div>
                <label className="label">Site</label>
                <select name="warehouseId" className="input" defaultValue={sp.wh ?? ''}>
                  <option value="">— Virtuel —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Local parent</label>
                <select name="parentId" className="input" defaultValue="">
                  <option value="">— Racine —</option>
                  {locations
                    .filter((l) => l.type === 'view' || l.type === 'internal')
                    .map((l) => (
                      <option key={l.id} value={l.id}>{l.fullPath}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select name="type" className="input" defaultValue="internal">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Code-barres (optionnel)</label>
                <input name="barcode" className="input" placeholder="LOC-..." />
              </div>
              <button type="submit" className="btn-primary w-full">Créer le local</button>
            </form>
          </div>

          {/* Légende des types */}
          <div className="card p-4">
            <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Types de locaux</p>
            <div className="space-y-1.5">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${v.color.split(' ')[0]}`} />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
