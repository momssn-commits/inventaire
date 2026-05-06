import { redirect } from 'next/navigation';
import { Wrench, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createEquipment(formData: FormData) {
  'use server';
  const session = await requireSession();
  const name = String(formData.get('name') ?? '').trim();
  const reference = String(formData.get('reference') ?? '').trim();
  if (!name || !reference) redirect('/maintenance?error=missing');
  const created = await prisma.equipment.create({
    data: {
      reference,
      name,
      category: String(formData.get('category') ?? '') || null,
      location: String(formData.get('location') ?? '') || null,
      serial: String(formData.get('serial') ?? '') || null,
      companyId: session.companyId,
    },
  });
  await logAudit({
    action: 'create', entity: 'equipment', entityId: created.id,
    newValue: { reference, name },
    userId: session.userId, companyId: session.companyId,
  });
  redirect('/maintenance');
}

async function createRequest(formData: FormData) {
  'use server';
  await requireSession();
  const equipmentId = String(formData.get('equipmentId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!equipmentId || !title) redirect('/maintenance?error=missing');
  const reference = await nextSequence('MR', 'MR', 5);
  await prisma.maintenanceRequest.create({
    data: {
      reference,
      title,
      description: String(formData.get('description') ?? '') || null,
      type: String(formData.get('type') ?? 'corrective'),
      equipmentId,
      scheduledAt: String(formData.get('scheduledAt') ?? '')
        ? new Date(String(formData.get('scheduledAt')))
        : null,
    },
  });
  redirect('/maintenance');
}

export default async function MaintenancePage() {
  const session = await requireSession();
  const [equipments, requests] = await Promise.all([
    prisma.equipment.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: 'asc' },
    }),
    prisma.maintenanceRequest.findMany({
      include: { equipment: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Parc d'équipements et interventions préventives / correctives"
        module="M9"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold">Équipements</h3>
          </div>
          {equipments.length === 0 ? (
            <EmptyState icon={Wrench} title="Aucun équipement" />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Localisation</th>
                  <th>N° série</th>
                </tr>
              </thead>
              <tbody>
                {equipments.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{e.reference}</td>
                    <td>{e.name}</td>
                    <td className="text-sm">{e.category ?? '—'}</td>
                    <td className="text-sm">{e.location ?? '—'}</td>
                    <td className="text-xs font-mono">{e.serial ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvel équipement</h3>
          <form action={createEquipment} className="space-y-3">
            <div>
              <label className="label">Référence *</label>
              <input name="reference" required className="input" placeholder="EQ-002" />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <input name="category" className="input" />
            </div>
            <div>
              <label className="label">Localisation</label>
              <input name="location" className="input" />
            </div>
            <div>
              <label className="label">N° série</label>
              <input name="serial" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Créer</button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold">Demandes de maintenance</h3>
          </div>
          {requests.length === 0 ? (
            <EmptyState icon={Wrench} title="Aucune demande" />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Titre</th>
                  <th>Équipement</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Prévu</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.reference}</td>
                    <td>{r.title}</td>
                    <td className="text-sm">{r.equipment.name}</td>
                    <td className="text-xs capitalize">{r.type}</td>
                    <td><StatusBadge value={r.state} /></td>
                    <td className="text-sm">{formatDate(r.scheduledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvelle demande</h3>
          <form action={createRequest} className="space-y-3">
            <div>
              <label className="label">Équipement *</label>
              <select name="equipmentId" required className="input">
                <option value="">—</option>
                {equipments.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Titre *</label>
              <input name="title" required className="input" />
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="corrective">
                <option value="corrective">Corrective</option>
                <option value="preventive">Préventive</option>
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" className="input" rows={2} />
            </div>
            <div>
              <label className="label">Date prévue</label>
              <input name="scheduledAt" type="datetime-local" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Créer la demande</button>
          </form>
        </div>
      </div>
    </div>
  );
}
