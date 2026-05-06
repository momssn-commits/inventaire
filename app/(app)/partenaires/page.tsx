import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, Plus, Mail, Phone } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession, logAudit } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

async function createPartner(formData: FormData) {
  'use server';
  const session = await requireSession();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/partenaires?error=missing');
  const created = await prisma.partner.create({
    data: {
      name,
      code: String(formData.get('code') ?? '') || null,
      email: String(formData.get('email') ?? '') || null,
      phone: String(formData.get('phone') ?? '') || null,
      city: String(formData.get('city') ?? '') || null,
      type: String(formData.get('type') ?? 'supplier'),
      companyId: session.companyId,
    },
  });
  await logAudit({
    action: 'create', entity: 'partner', entityId: created.id,
    newValue: { name, type: created.type },
    userId: session.userId, companyId: session.companyId,
  });
  redirect('/partenaires');
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const partners = await prisma.partner.findMany({
    where: {
      companyId: session.companyId,
      deletedAt: null,
      ...(sp.type ? { type: sp.type } : {}),
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <PageHeader
        title="Partenaires"
        subtitle="Fournisseurs et clients"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-3">
            <Link href="/partenaires" className={`btn-ghost ${!sp.type ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>Tous</Link>
            <Link href="/partenaires?type=supplier" className={`btn-ghost ${sp.type === 'supplier' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>Fournisseurs</Link>
            <Link href="/partenaires?type=customer" className={`btn-ghost ${sp.type === 'customer' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}>Clients</Link>
          </div>
          <div className="card overflow-x-auto">
            {partners.length === 0 ? (
              <EmptyState icon={Users} title="Aucun partenaire" />
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Contact</th>
                    <th>Ville</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.code ?? '—'}</td>
                      <td className="font-medium">{p.name}</td>
                      <td>
                        <span className="badge bg-zinc-100 dark:bg-zinc-800 text-xs">
                          {p.type === 'supplier' ? 'Fournisseur' : p.type === 'customer' ? 'Client' : 'Mixte'}
                        </span>
                      </td>
                      <td className="text-xs">
                        {p.email && <div className="flex items-center gap-1"><Mail className="size-3" />{p.email}</div>}
                        {p.phone && <div className="flex items-center gap-1"><Phone className="size-3" />{p.phone}</div>}
                      </td>
                      <td className="text-sm">{p.city ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus className="size-4" /> Nouveau partenaire</h3>
          <form action={createPartner} className="space-y-3">
            <div>
              <label className="label">Code</label>
              <input name="code" className="input" placeholder="F-003" />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="supplier">
                <option value="supplier">Fournisseur</option>
                <option value="customer">Client</option>
                <option value="both">Mixte</option>
              </select>
            </div>
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input name="phone" className="input" />
            </div>
            <div>
              <label className="label">Ville</label>
              <input name="city" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full">Créer</button>
          </form>
        </div>
      </div>
    </div>
  );
}
