import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Plus, Tag } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  internal: 'Interne',
  view: 'Vue',
  supplier: 'Fournisseur',
  customer: 'Client',
  transit: 'Transit',
  inventory: 'Inventaire',
  production: 'Production',
  scrap: 'Rebut',
};

async function createLocation(formData: FormData) {
  'use server';
  await requireRole(['admin', 'manager']);
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

  await prisma.location.create({
    data: { name, fullPath, type, warehouseId, parentId, barcode },
  });
  redirect(`/emplacements${warehouseId ? `?wh=${warehouseId}` : ''}`);
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
      ...(sp.wh ? { warehouseId: sp.wh } : {}),
      ...(sp.type ? { type: sp.type } : {}),
    },
    include: {
      warehouse: true,
      parent: true,
      _count: { select: { stockLinesIn: true, children: true } },
    },
    orderBy: { fullPath: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Emplacements"
        subtitle="Hiérarchie arborescente des emplacements de stockage"
        module="M2"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="card p-3 mb-3">
            <form className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Entrepôt</label>
                <select name="wh" defaultValue={sp.wh ?? ''} className="input">
                  <option value="">Tous</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="label">Type</label>
                <select name="type" defaultValue={sp.type ?? ''} className="input">
                  <option value="">Tous</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary">Filtrer</button>
            </form>
          </div>

          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Chemin</th>
                  <th>Type</th>
                  <th>Entrepôt</th>
                  <th>Code-barres</th>
                  <th className="text-right">Lignes stock</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3 text-zinc-400" />
                        <span className="font-mono text-xs">{l.fullPath}</span>
                      </div>
                    </td>
                    <td className="text-xs">{TYPE_LABELS[l.type] ?? l.type}</td>
                    <td className="text-sm">{l.warehouse?.name ?? <span className="text-zinc-400 italic">virtuel</span>}</td>
                    <td>
                      {l.barcode && (
                        <span className="badge bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">
                          <Tag className="size-2.5 mr-1" />
                          {l.barcode}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-sm">{formatNumber(l._count.stockLinesIn, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {locations.length === 0 && (
              <div className="p-8 text-center text-sm text-zinc-500">Aucun emplacement.</div>
            )}
          </div>
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvel emplacement</h3>
          <form action={createLocation} className="space-y-3">
            <div>
              <label className="label">Nom *</label>
              <input name="name" required className="input" placeholder="Casier-7" />
            </div>
            <div>
              <label className="label">Entrepôt</label>
              <select name="warehouseId" className="input" defaultValue={sp.wh ?? ''}>
                <option value="">— Virtuel —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Parent</label>
              <select name="parentId" className="input" defaultValue="">
                <option value="">— Racine —</option>
                {locations.filter((l) => l.type === 'view' || l.type === 'internal').map((l) => (
                  <option key={l.id} value={l.id}>{l.fullPath}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="internal">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Code-barres</label>
              <input name="barcode" className="input" placeholder="LOC-..." />
            </div>
            <button type="submit" className="btn-primary w-full">Créer l'emplacement</button>
          </form>
        </div>
      </div>
    </div>
  );
}
