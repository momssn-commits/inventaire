import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { PageHeader } from '@/components/PageHeader';

async function createPicking(formData: FormData) {
  'use server';
  const session = await requireSession();
  const type = String(formData.get('type') ?? 'receipt');
  const partnerId = String(formData.get('partnerId') ?? '') || null;
  const fromWarehouseId = String(formData.get('fromWarehouseId') ?? '') || null;
  const toWarehouseId = String(formData.get('toWarehouseId') ?? '') || null;
  const scheduledAt = String(formData.get('scheduledAt') ?? '');
  const notes = String(formData.get('notes') ?? '') || null;

  let prefix = 'WH/';
  let seqCode = 'PICKING_RECEIPT';
  if (type === 'receipt') { prefix = 'WH/IN/'; seqCode = 'PICKING_RECEIPT'; }
  if (type === 'delivery') { prefix = 'WH/OUT/'; seqCode = 'PICKING_DELIVERY'; }
  if (type === 'internal') { prefix = 'WH/INT/'; seqCode = 'PICKING_INTERNAL'; }

  const reference = await nextSequence(seqCode, prefix, 5);

  const picking = await prisma.picking.create({
    data: {
      reference,
      type,
      state: 'draft',
      partnerId,
      fromWarehouseId,
      toWarehouseId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      notes,
      companyId: session.companyId,
    },
  });

  await logAudit({
    action: 'create', entity: 'picking', entityId: picking.id,
    userId: session.userId, companyId: session.companyId,
  });

  redirect(`/operations/${picking.id}`);
}

export default async function NewPickingPage() {
  const session = await requireSession();
  const partners = await prisma.partner.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: { name: 'asc' },
  });
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Nouveau mouvement"
        subtitle="Créez un mouvement de stock (réception, expédition, transfert)"
        module="M3"
        actions={<Link href="/operations" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />

      <form action={createPicking} className="card p-5 space-y-4">
        <div>
          <label className="label">Type d'opération *</label>
          <select name="type" required className="input">
            <option value="receipt">Réception (entrée)</option>
            <option value="delivery">Expédition (sortie)</option>
            <option value="internal">Transfert interne</option>
            <option value="return">Retour</option>
          </select>
        </div>

        <div>
          <label className="label">Partenaire (fournisseur / client)</label>
          <select name="partnerId" className="input" defaultValue="">
            <option value="">— Aucun —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Entrepôt source</label>
            <select name="fromWarehouseId" className="input" defaultValue="">
              <option value="">— Aucun —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entrepôt destination</label>
            <select name="toWarehouseId" className="input" defaultValue="">
              <option value="">— Aucun —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Date prévue</label>
          <input
            type="datetime-local"
            name="scheduledAt"
            className="input"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea name="notes" className="input" rows={3} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary">Créer le mouvement</button>
          <Link href="/operations" className="btn-ghost">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
