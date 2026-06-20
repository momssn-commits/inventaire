import { redirect } from 'next/navigation';
import { ShieldCheck, ShieldAlert, Plus, AlertCircle, Shield } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createAlert(formData: FormData) {
  'use server';
  const session = await requireSession();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) redirect('/qualite?error=missing');
  const reference = await nextSequence('QA', 'QA', 5);
  const alert = await prisma.qualityAlert.create({
    data: {
      reference,
      title,
      description: String(formData.get('description') ?? '') || null,
      severity: String(formData.get('severity') ?? 'medium'),
      productId: String(formData.get('productId') ?? '') || null,
      partnerId: String(formData.get('partnerId') ?? '') || null,
      assignedTo: String(formData.get('assignedTo') ?? '') || null,
      companyId: session.companyId,
    },
  });
  await logAudit({
    action: 'create', entity: 'qualityAlert', entityId: alert.id,
    newValue: { reference, title, severity: alert.severity },
    userId: session.userId, companyId: session.companyId,
  });
  redirect('/qualite');
}

async function createCheckPoint(formData: FormData) {
  'use server';
  const session = await requireSession();
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
      companyId: session.companyId,
    },
  });
  redirect('/qualite');
}

async function updateAlert(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') ?? '');
  const state = String(formData.get('state') ?? '');
  const assignedTo = String(formData.get('assignedTo') ?? '') || null;
  await prisma.qualityAlert.updateMany({
    where: { id, companyId: session.companyId },
    data: {
      state,
      assignedTo,
      ...(state === 'resolved' ? { resolvedAt: new Date() } : {}),
    },
  });
  await logAudit({
    action: 'update', entity: 'qualityAlert', entityId: id,
    newValue: { state, assignedTo },
    userId: session.userId, companyId: session.companyId,
  });
  redirect('/qualite');
}


function TriggerBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    reception: 'Réception', manufacturing: 'Fabrication', delivery: 'Expédition',
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {labels[value] ?? value}
    </span>
  );
}

function TypeBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    pass_fail: 'Réussite/Échec', measure: 'Mesure', photo: 'Photo', instructions: 'Instructions',
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      {labels[value] ?? value}
    </span>
  );
}

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === 'qcp' ? 'qcp' : 'alerts';

  const session = await requireSession();
  const [alerts, qcps, products, partners] = await Promise.all([
    prisma.qualityAlert.findMany({
      where: { companyId: session.companyId },
      orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.qualityCheckPoint.findMany({
      where: { active: true, companyId: session.companyId },
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

  const kpiActives = alerts.filter((a) => a.state !== 'resolved').length;
  const kpiCritiques = alerts.filter((a) => a.severity === 'critical').length;
  const kpiQcps = qcps.length;
  const kpiResolues = alerts.filter((a) => a.state === 'resolved').length;

  return (
    <div>
      <PageHeader
        title="Contrôle qualité"
        subtitle="Points de contrôle, alertes qualité, mesures et validation"
        module="M6"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Alertes actives" value={kpiActives} icon={ShieldAlert} tone="warning" />
        <KpiCard label="Critiques" value={kpiCritiques} icon={AlertCircle} tone="danger" />
        <KpiCard label="Points de contrôle" value={kpiQcps} icon={Shield} tone="info" />
        <KpiCard label="Résolues" value={kpiResolues} icon={ShieldCheck} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            <a
              href="/qualite?tab=alerts"
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'alerts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Alertes qualité
            </a>
            <a
              href="/qualite?tab=qcp"
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'qcp'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Points de contrôle
            </a>
          </div>

          {tab === 'alerts' && (
            <div className="card overflow-x-auto">
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
                      <th>Assigné à</th>
                      <th>Créé le</th>
                      <th>Résolu le</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono text-xs">{a.reference}</td>
                        <td className="max-w-[200px]">
                          <div className="font-medium text-sm truncate">{a.title}</div>
                        </td>
                        <td><StatusBadge value={a.severity} /></td>
                        <td><StatusBadge value={a.state} /></td>
                        <td className="text-sm">{(a as any).assignedTo ?? '—'}</td>
                        <td className="text-sm">{formatDate(a.createdAt)}</td>
                        <td className="text-sm">{a.resolvedAt ? formatDate(a.resolvedAt) : '—'}</td>
                        <td>
                          {a.state !== 'resolved' && (
                            <form action={updateAlert} className="flex flex-col gap-1 min-w-[180px]">
                              <input type="hidden" name="id" value={a.id} />
                              <input
                                name="assignedTo"
                                defaultValue={(a as any).assignedTo ?? ''}
                                placeholder="Responsable…"
                                className="input text-xs py-1"
                              />
                              <div className="flex gap-1">
                                <select name="state" defaultValue={a.state} className="input text-xs py-1 flex-1">
                                  <option value="new">Nouveau</option>
                                  <option value="in_progress">En cours</option>
                                  <option value="action">Action engagée</option>
                                  <option value="resolved">Résolu</option>
                                </select>
                                <button type="submit" className="btn-secondary text-xs px-2">✓</button>
                              </div>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'qcp' && (
            <div className="card overflow-x-auto">
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
                        <td><TriggerBadge value={qcp.trigger} /></td>
                        <td><TypeBadge value={qcp.type} /></td>
                        <td className="text-sm">{qcp.product?.name ?? '—'}</td>
                        <td className="text-xs">{qcp.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" /> Nouvelle alerte
            </h3>
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
              <div>
                <label className="label">Assigner à</label>
                <input name="assignedTo" placeholder="Nom du responsable" className="input" />
              </div>
              <button type="submit" className="btn-primary w-full">Créer l'alerte</button>
            </form>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="size-4" /> Nouveau QCP
            </h3>
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
    </div>
  );
}
