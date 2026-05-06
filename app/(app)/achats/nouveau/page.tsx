import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { nextSequence } from '@/lib/sequence';
import { PageHeader } from '@/components/PageHeader';

async function createPO(formData: FormData) {
  'use server';
  const session = await requireSession();
  const partnerId = String(formData.get('partnerId') ?? '');
  if (!partnerId) redirect('/achats/nouveau?error=missing');
  const reference = await nextSequence('PO', 'PO', 5);
  const po = await prisma.purchaseOrder.create({
    data: {
      reference,
      state: 'draft',
      partnerId,
      orderedAt: new Date(),
      expectedAt: new Date(Date.now() + 14 * 86400000),
      notes: String(formData.get('notes') ?? '') || null,
      companyId: session.companyId,
    },
  });
  redirect(`/achats/${po.id}`);
}

export default async function NewPOPage() {
  const session = await requireSession();
  const suppliers = await prisma.partner.findMany({
    where: {
      companyId: session.companyId,
      deletedAt: null,
      OR: [{ type: 'supplier' }, { type: 'both' }],
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Nouveau bon de commande"
        module="M7"
        actions={<Link href="/achats" className="btn-secondary"><ArrowLeft className="size-4" /> Retour</Link>}
      />
      <form action={createPO} className="card p-5 space-y-4">
        <div>
          <label className="label">Fournisseur *</label>
          <select name="partnerId" required className="input">
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" className="input" rows={3} />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">Créer le bon de commande</button>
          <Link href="/achats" className="btn-ghost">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
