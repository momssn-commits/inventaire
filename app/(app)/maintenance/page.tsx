import { redirect } from 'next/navigation';
import { Wrench, Plus, Settings, AlertCircle, CalendarClock, CheckCircle2, Shield } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
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
      where: { equipment: { companyId: session.companyId } },
      include: { equipment: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const kpiActifs = equipments.filter((e) => e.active).length;
  const kpiEnCours = requests.filter((r) => r.state === 'in_progress' || r.state === 'scheduled').length;
  const kpiPreventives = requests.filter((r) => r.type === 'preventive' && r.state !== 'done').length;
  const kpiTerminees = requests.filter((r) => r.state === 'done').length;

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Parc d'équipements et interventions préventives / correctives"
        module="M9"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Équipements actifs" value={kpiActifs} icon={Settings} tone="info" />
        <KpiCard label="Interventions en cours" value={kpiEnCours} icon={AlertCircle} tone="warning" />
        <KpiCard label="Préventives planifiées" value={kpiPreventives} icon={CalendarClock} tone="warning" />
        <KpiCard label="Terminées" value={kpiTerminees} icon={CheckCircle2} tone="success" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Requests table */}
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Wrench className="size-4 text-muted-foreground" /> Demandes de maintenance
            </h3>
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
                  <th>Prévu le</th>
                  <th>Terminé le</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.reference}</td>
                    <td>{r.title}</td>
                    <td className="text-sm">{r.equipment.name}</td>
                    <td><StatusBadge value={r.type} /></td>
                    <td><StatusBadge value={r.state} /></td>
                    <td className="text-sm">{r.scheduledAt ? formatDate(r.scheduledAt) : '—'}</td>
                    <td className="text-sm">{r.doneAt ? formatDate(r.doneAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right side forms */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" /> Nouvel équipement
            </h3>
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

          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" /> Nouvelle demande
            </h3>
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

      {/* Equipment park */}
      <div className="card overflow-x-auto">
        <div className="p-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" /> Parc d'équipements
          </h3>
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
                <th>Fin garantie</th>
                <th>Actif</th>
              </tr>
            </thead>
            <tbody>
              {equipments.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.reference}</td>
                  <td>{e.name}</td>
                  <td className="text-sm">{e.category ?? '—'}</td>
                  <td className="text-sm">{e.location ?? '—'}</td>
                  <td className="font-mono text-xs">{e.serial ?? '—'}</td>
                  <td className="text-sm">{e.warrantyEndsAt ? formatDate(e.warrantyEndsAt) : '—'}</td>
                  <td>
                    {e.active
                      ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Actif</span>
                      : <span className="badge bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Inactif</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
