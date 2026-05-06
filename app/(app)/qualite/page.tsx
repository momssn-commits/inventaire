import { redirect } from 'next/navigation';
import { ShieldCheck, Plus, ShieldAlert } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createAlert(formData: FormData) {
  'use server';
  const session = await requireSession();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) redirect('/qualite?error=missing');
  const reference = await nextSequence('QA', 'QA', 5);
  await prisma.qualityAlert.create({
    data: {
      reference,
      title,
      description: String(formData.get('description') ?? '') || null,
      severity: String(formData.get('severity') ?? 'medium'),
      productId: String(formData.get('productId') ?? '') || null,
      partnerId: String(formData.get('partnerId') ?? '') || null,
      companyId: session.companyId,
    },
  });
  redirect('/qualite');
}

async function createCheckPoint(formData: FormData) {
  'use server';
  await requireSession();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/qualite?error=missing');
  await prisma.qualityCheckPoint.create({
    data: {
      name,
      trigger: String(formData.get('trigger') ?? 'reception'),
      type: String(formData.get('type') ?? 'pass_fail'),
      productId: String(formData.get('productId') ?? '') || null,
      measureMin: Number(formData.get('measureMin') ?? 0) || null,
      measureMax: Number(formData.get('measureMax') ?? 0) || null,
      frequency: String(formData.get('frequency') ?? 'all'),
      frequencyValue: Number(formData.get('frequencyValue') ?? 1),
    },
  });
  redirect('/qualite');
}

async function updateAlertState(formData: FormData) {
  'use server';
  await requireSession();
  const id = String(formData.get('id') ?? '');
  const state = String(formData.get('state') ?? '');
  await prisma.qualityAlert.update({
    where: { id },
    data: {
      state,
      ...(state === 'resolved' ? { resolvedAt: new Date() } : {}),
    },
  });
  redirect('/qualite');
}

export default async function QualityPage() {
  const session = await requireSession();
  const [alerts, qcps, products, partners] = await Promise.all([
    prisma.qualityAlert.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.qualityCheckPoint.findMany({
      where: { active: true },
      include: { product: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { companyId: session.companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.partner.findMany({
      where: { companyId: session.companyId, deletedAt: null, type: 'supplier' },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contrôle qualité"
        subtitle="Points de contrôle, alertes qualité, mesures et validation"
        module="M6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="size-4 text-red-600" /> Alertes qualité</h3>
          </div>
          {alerts.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Aucune alerte" description="Tous les contrôles sont conformes." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Titre</th>
                  <th>Sévérité</th>
                  <th>Statut</th>
                  <th>Créée</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs">{a.reference}</td>
                    <td>{a.title}</td>
                    <td><StatusBadge value={a.severity} /></td>
                    <td><StatusBadge value={a.state} /></td>
                    <td className="text-sm">{formatDate(a.createdAt)}</td>
                    <td>
                      {a.state !== 'resolved' && (
                        <form action={updateAlertState}>
                          <input type="hidden" name="id" value={a.id} />
                          <select name="state" defaultValue={a.state} className="input text-xs py-1">
                            <option value="new">Nouveau</option>
                            <option value="in_progress">En cours</option>
                            <option value="action">Action engagée</option>
                            <option value="resolved">Résolu</option>
                          </select>
                          <button type="submit" className="btn-ghost text-xs ml-2">MAJ</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvelle alerte</h3>
          <form action={createAlert} className="space-y-3">
            <div>
              <label className="label">Titre *</label>
              <input name="title" required className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" className="input" rows={3} />
            </div>
            <div>
              <label className="label">Sévérité</label>
              <select name="severity" className="input" defaultValue="medium">
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="critical">Critique</option>
              </select>
            </div>
            <div>
              <label className="label">Produit concerné</label>
              <select name="productId" className="input">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <select name="partnerId" className="input">
                <option value="">—</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Créer l'alerte</button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-semibold">Points de contrôle qualité (QCP)</h3>
          </div>
          {qcps.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Aucun point de contrôle" />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Déclencheur</th>
                  <th>Type</th>
                  <th>Produit</th>
                  <th>Fréquence</th>
                </tr>
              </thead>
              <tbody>
                {qcps.map((qcp) => (
                  <tr key={qcp.id}>
                    <td>{qcp.name}</td>
                    <td className="text-xs capitalize">{qcp.trigger}</td>
                    <td className="text-xs">
                      {qcp.type === 'pass_fail' ? 'Réussite/Échec' : qcp.type === 'measure' ? 'Mesure' : qcp.type === 'photo' ? 'Photo' : 'Instructions'}
                    </td>
                    <td className="text-sm">{qcp.product?.name ?? '—'}</td>
                    <td className="text-xs">{qcp.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouveau QCP</h3>
          <form action={createCheckPoint} className="space-y-3">
            <div>
              <label className="label">Nom *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Déclencheur</label>
              <select name="trigger" className="input" defaultValue="reception">
                <option value="reception">Réception</option>
                <option value="manufacturing">Fabrication</option>
                <option value="delivery">Expédition</option>
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="pass_fail">
                <option value="instructions">Instructions</option>
                <option value="pass_fail">Réussite/Échec</option>
                <option value="measure">Mesure</option>
                <option value="photo">Photo</option>
              </select>
            </div>
            <div>
              <label className="label">Produit</label>
              <select name="productId" className="input">
                <option value="">— Tous —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Min</label>
                <input type="number" step="0.01" name="measureMin" className="input" />
              </div>
              <div>
                <label className="label">Max</label>
                <input type="number" step="0.01" name="measureMax" className="input" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">Créer le QCP</button>
          </form>
        </div>
      </div>
    </div>
  );
}
