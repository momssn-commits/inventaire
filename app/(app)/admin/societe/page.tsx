import { redirect } from 'next/navigation';
import { Building2, Boxes, Tag, Ruler } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';

export const dynamic = 'force-dynamic';

const CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD'];
const LOCALES = ['fr-FR', 'en-US'];

async function updateCompany(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const name = String(formData.get('name') ?? '').trim();
  const currency = String(formData.get('currency') ?? 'XOF');
  const locale = String(formData.get('locale') ?? 'fr-FR');
  if (!name) redirect('/admin/societe?error=1');
  await prisma.company.update({ where: { id: session.companyId }, data: { name, currency, locale } });
  await logAudit({ action: 'update', entity: 'company', entityId: session.companyId, newValue: { name, currency, locale }, userId: session.userId, companyId: session.companyId });
  redirect('/admin/societe?ok=1');
}

export default async function AdminCompanyPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireRole(['admin']);
  const sp = await searchParams;
  const company = await prisma.company.findUnique({ where: { id: session.companyId } });

  const [products, categories, uoms] = await Promise.all([
    prisma.product.count({ where: { companyId: session.companyId, deletedAt: null } }),
    prisma.category.count(),
    prisma.uom.count(),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Société" subtitle="Informations générales et données de référence." />

      {sp.ok && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#e5f7ef', border: '1px solid #b6e6cf', color: 'rgb(14 163 113)' }}>Paramètres enregistrés.</div>}
      {sp.error && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#fdeaea', border: '1px solid #f5c2c4', color: 'rgb(229 72 77)' }}>Le nom est obligatoire.</div>}

      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Produits" value={products} icon={Boxes} tone="info" />
        <KpiCard label="Catégories" value={categories} icon={Tag} tone="success" />
        <KpiCard label="Unités de mesure" value={uoms} icon={Ruler} tone="warning" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="size-[18px]" style={{ color: 'rgb(37 99 235)' }} /> Informations société</h3>
          <form action={updateCompany} className="space-y-4">
            <div><label className="label">Nom de la société</label><input name="name" required defaultValue={company?.name ?? ''} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Devise</label>
                <select name="currency" defaultValue={company?.currency ?? 'XOF'} className="input">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div><label className="label">Langue / région</label>
                <select name="locale" defaultValue={company?.locale ?? 'fr-FR'} className="input">{LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}</select>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'rgb(100 116 139)' }}>
              Code société : <span className="sku">{company?.code}</span>
            </div>
            <button className="btn-primary">Enregistrer</button>
          </form>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold mb-4">Données de référence</h3>
          <p className="text-sm mb-4" style={{ color: 'rgb(100 116 139)' }}>
            Les catégories, unités de mesure et emplacements structurent votre catalogue et vos stocks.
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between py-2" style={{ borderBottom: '1px solid rgb(232 236 244)' }}><span style={{ color: 'rgb(100 116 139)' }}>Catégories de produits</span><span className="font-semibold">{categories}</span></li>
            <li className="flex justify-between py-2" style={{ borderBottom: '1px solid rgb(232 236 244)' }}><span style={{ color: 'rgb(100 116 139)' }}>Unités de mesure</span><span className="font-semibold">{uoms}</span></li>
            <li className="flex justify-between py-2"><span style={{ color: 'rgb(100 116 139)' }}>Produits actifs</span><span className="font-semibold">{products}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
