import { redirect } from 'next/navigation';
import { RotateCcw, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { formatDate, formatMoney } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createRepair(formData: FormData) {
  'use server';
  const session = await requireSession();
  const productName = String(formData.get('productName') ?? '').trim();
  if (!productName) redirect('/reparations?error=missing');
  const reference = await nextSequence('REPAIR', 'REP', 5);
  await prisma.repairOrder.create({
    data: {
      reference,
      productName,
      customerName: String(formData.get('customerName') ?? '') || null,
      diagnosis: String(formData.get('diagnosis') ?? '') || null,
      quoteHt: Number(formData.get('quoteHt') ?? 0),
      notes: String(formData.get('notes') ?? '') || null,
      companyId: session.companyId,
    },
  });
  redirect('/reparations');
}

async function updateRepair(formData: FormData) {
  'use server';
  await requireSession();
  const id = String(formData.get('id') ?? '');
  const state = String(formData.get('state') ?? '');
  await prisma.repairOrder.update({
    where: { id },
    data: {
      state,
      ...(state === 'done' ? { doneAt: new Date() } : {}),
    },
  });
  redirect('/reparations');
}

export default async function RepairsPage() {
  const session = await requireSession();
  const repairs = await prisma.repairOrder.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <div>
      <PageHeader
        title="Réparations"
        subtitle="Traitement des produits retournés ou défectueux"
        module="M11"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          {repairs.length === 0 ? (
            <EmptyState icon={RotateCcw} title="Aucune réparation" />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Produit</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th className="text-right">Devis HT</th>
                  <th>Créée</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.reference}</td>
                    <td>{r.productName}</td>
                    <td className="text-sm">{r.customerName ?? '—'}</td>
                    <td><StatusBadge value={r.state} /></td>
                    <td className="text-right tabular-nums">{formatMoney(r.quoteHt)}</td>
                    <td className="text-sm">{formatDate(r.createdAt)}</td>
                    <td>
                      {r.state !== 'done' && (
                        <form action={updateRepair} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <select name="state" defaultValue={r.state} className="input text-xs py-1">
                            <option value="new">Nouveau</option>
                            <option value="quoted">Devis émis</option>
                            <option value="in_progress">En cours</option>
                            <option value="done">Terminée</option>
                            <option value="cancelled">Annulée</option>
                          </select>
                          <button type="submit" className="btn-ghost text-xs">MAJ</button>
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
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouvelle réparation</h3>
          <form action={createRepair} className="space-y-3">
            <div>
              <label className="label">Produit *</label>
              <input name="productName" required className="input" placeholder="Ex: Vélo électrique Urban" />
            </div>
            <div>
              <label className="label">Client</label>
              <input name="customerName" className="input" />
            </div>
            <div>
              <label className="label">Diagnostic initial</label>
              <textarea name="diagnosis" className="input" rows={3} />
            </div>
            <div>
              <label className="label">Devis HT (FCFA)</label>
              <input name="quoteHt" type="number" step="100" min="0" className="input" defaultValue="0" />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea name="notes" className="input" rows={2} />
            </div>
            <button type="submit" className="btn-primary w-full">Créer la réparation</button>
          </form>
        </div>
      </div>
    </div>
  );
}
