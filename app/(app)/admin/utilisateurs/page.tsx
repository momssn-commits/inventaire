import { redirect } from 'next/navigation';
import { Users, UserPlus, ShieldCheck, KeyRound, Lock, Unlock, Power } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireRole, hashPassword, logAudit } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';

export const dynamic = 'force-dynamic';

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'manager', label: 'Manager' },
  { value: 'operator', label: 'Opérateur' },
  { value: 'user', label: 'Utilisateur' },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

async function createUser(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'user');
  if (!name || !email || password.length < 6) redirect('/admin/utilisateurs?error=invalid');
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect('/admin/utilisateurs?error=exists');
  const passwordHash = await hashPassword(password);
  const u = await prisma.user.create({
    data: { name, email, passwordHash, role, active: true, companyId: session.companyId },
  });
  await logAudit({ action: 'create', entity: 'user', entityId: u.id, newValue: { email, role }, userId: session.userId, companyId: session.companyId });
  redirect('/admin/utilisateurs?ok=created');
}

async function updateUser(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? 'user');
  await prisma.user.updateMany({ where: { id, companyId: session.companyId }, data: { name, role } });
  await logAudit({ action: 'update', entity: 'user', entityId: id, newValue: { name, role }, userId: session.userId, companyId: session.companyId });
  redirect('/admin/utilisateurs?ok=updated');
}

async function toggleActive(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  if (id === session.userId) redirect('/admin/utilisateurs?error=self');
  const u = await prisma.user.findFirst({ where: { id, companyId: session.companyId } });
  if (!u) redirect('/admin/utilisateurs');
  await prisma.user.update({ where: { id: u.id }, data: { active: !u.active } });
  await logAudit({ action: 'update', entity: 'user', entityId: id, newValue: { active: !u.active }, userId: session.userId, companyId: session.companyId });
  redirect('/admin/utilisateurs?ok=updated');
}

async function unlockUser(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  await prisma.user.updateMany({ where: { id, companyId: session.companyId }, data: { lockedUntil: null, failedAttempts: 0 } });
  redirect('/admin/utilisateurs?ok=unlocked');
}

async function resetPassword(formData: FormData) {
  'use server';
  const session = await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 6) redirect('/admin/utilisateurs?error=invalid');
  const passwordHash = await hashPassword(password);
  await prisma.user.updateMany({ where: { id, companyId: session.companyId }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } });
  await logAudit({ action: 'update', entity: 'user', entityId: id, newValue: { passwordReset: true }, userId: session.userId, companyId: session.companyId });
  redirect('/admin/utilisateurs?ok=password');
}

function RoleBadge({ role }: { role: string }) {
  const cls = role === 'admin' ? 'b-danger' : role === 'manager' ? 'b-info' : role === 'operator' ? 'b-warn' : 'b-neutral';
  return <span className={`badge ${cls}`}>{roleLabel(role)}</span>;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await requireRole(['admin']);
  const sp = await searchParams;

  const users = await prisma.user.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  const now = new Date();
  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.active).length;
  const lockedCount = users.filter((u) => u.lockedUntil && u.lockedUntil > now).length;

  const messages: Record<string, string> = {
    created: 'Utilisateur créé.', updated: 'Modifications enregistrées.', password: 'Mot de passe réinitialisé.', unlocked: 'Compte déverrouillé.',
  };
  const errors: Record<string, string> = {
    invalid: 'Champs invalides (mot de passe : 6 caractères minimum).', exists: 'Un utilisateur avec cet e-mail existe déjà.', self: 'Vous ne pouvez pas désactiver votre propre compte.',
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        count={users.length}
        subtitle="Gérez les comptes, les rôles et la sécurité des accès."
      />

      {sp.ok && messages[sp.ok] && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#e5f7ef', border: '1px solid #b6e6cf', color: 'rgb(14 163 113)' }}>{messages[sp.ok]}</div>
      )}
      {sp.error && errors[sp.error] && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#fdeaea', border: '1px solid #f5c2c4', color: 'rgb(229 72 77)' }}>{errors[sp.error]}</div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Comptes" value={users.length} icon={Users} tone="info" />
        <KpiCard label="Actifs" value={activeCount} icon={Power} tone="success" />
        <KpiCard label="Administrateurs" value={adminCount} icon={ShieldCheck} tone="warning" />
        <KpiCard label="Verrouillés" value={lockedCount} icon={Lock} tone="danger" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Liste */}
        <div className="xl:col-span-2 card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const locked = u.lockedUntil && u.lockedUntil > now;
                const isSelf = u.id === session.userId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-semibold text-[14px]">{u.name}{isSelf && <span className="ml-1.5 text-[11px]" style={{ color: 'rgb(100 116 139)' }}>(vous)</span>}</div>
                      <div className="text-[12.5px] mono" style={{ color: 'rgb(100 116 139)' }}>{u.email}</div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      {!u.active ? <span className="badge b-neutral dot">Désactivé</span>
                        : locked ? <span className="badge b-danger dot">Verrouillé</span>
                        : <span className="badge b-ok dot">Actif</span>}
                    </td>
                    <td className="text-[13px]" style={{ color: 'rgb(100 116 139)' }}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                    <td>
                      <details className="relative">
                        <summary className="btn-secondary text-xs cursor-pointer list-none py-1.5 px-2.5 inline-flex">Gérer</summary>
                        <div className="absolute right-0 z-20 mt-2 w-72 card p-3 space-y-3" style={{ boxShadow: 'var(--shadow-md)' }}>
                          <form action={updateUser} className="space-y-2">
                            <input type="hidden" name="id" value={u.id} />
                            <label className="label text-xs">Nom</label>
                            <input name="name" defaultValue={u.name} className="input text-sm" />
                            <label className="label text-xs">Rôle</label>
                            <select name="role" defaultValue={u.role} className="input text-sm">
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <button className="btn-primary w-full text-sm">Enregistrer</button>
                          </form>
                          <form action={resetPassword} className="flex gap-2 items-end pt-2" style={{ borderTop: '1px solid rgb(232 236 244)' }}>
                            <input type="hidden" name="id" value={u.id} />
                            <div className="flex-1">
                              <label className="label text-xs">Nouveau mot de passe</label>
                              <input name="password" type="text" placeholder="6 car. min." className="input text-sm" />
                            </div>
                            <button className="btn-secondary text-sm" title="Réinitialiser"><KeyRound className="size-4" /></button>
                          </form>
                          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgb(232 236 244)' }}>
                            {locked && (
                              <form action={unlockUser} className="flex-1"><input type="hidden" name="id" value={u.id} />
                                <button className="btn-secondary w-full text-sm"><Unlock className="size-4" /> Déverrouiller</button>
                              </form>
                            )}
                            {!isSelf && (
                              <form action={toggleActive} className="flex-1"><input type="hidden" name="id" value={u.id} />
                                <button className={`w-full text-sm ${u.active ? 'btn-danger' : 'btn-secondary'}`}>
                                  <Power className="size-4" /> {u.active ? 'Désactiver' : 'Activer'}
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Création */}
        <div className="card p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="size-[18px]" style={{ color: 'rgb(37 99 235)' }} /> Nouvel utilisateur</h3>
          <form action={createUser} className="space-y-3">
            <div><label className="label">Nom complet</label><input name="name" required className="input" placeholder="Prénom Nom" /></div>
            <div><label className="label">Adresse e-mail</label><input name="email" type="email" required className="input" placeholder="utilisateur@ifs.sn" /></div>
            <div><label className="label">Mot de passe</label><input name="password" type="text" required minLength={6} className="input" placeholder="6 caractères minimum" /></div>
            <div><label className="label">Rôle</label>
              <select name="role" defaultValue="user" className="input">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button className="btn-primary w-full"><UserPlus className="size-4" /> Créer le compte</button>
          </form>
          <p className="text-xs mt-3" style={{ color: 'rgb(100 116 139)' }}>
            Le rôle <b>Administrateur</b> donne un accès complet, y compris cette page d'administration.
          </p>
        </div>
      </div>
    </div>
  );
}
