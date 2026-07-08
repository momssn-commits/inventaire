import { redirect } from 'next/navigation';
import { Boxes } from 'lucide-react';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken, setSessionCookie, getSession, logAudit } from '@/lib/auth';

async function login(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/dashboard');
  if (!email || !password) {
    redirect('/login?error=missing');
  }
  const MAX_ATTEMPTS = 5;
  const LOCK_MINUTES = 15;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    redirect('/login?error=invalid');
  }
  // Verrouillage anti-force-brute : compte bloqué temporairement.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    redirect('/login?error=locked');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
      },
    });
    redirect(lock ? '/login?error=locked' : '/login?error=invalid');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null },
  });
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  });
  await setSessionCookie(token);
  await logAudit({ action: 'login', entity: 'user', entityId: user.id, userId: user.id, companyId: user.companyId });
  redirect(next.startsWith('/') ? next : '/dashboard');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');
  const { error, next } = await searchParams;

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(var(--bg))' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'rgb(10 11 22)', borderRight: '1px solid rgb(30 33 52)' }}>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)', boxShadow: '0 6px 16px -4px rgba(37,99,235,.55)' }}>
            <Boxes className="size-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white font-display">Inventaire Pro</span>
        </div>
        <div>
          <blockquote className="text-2xl font-semibold text-white leading-snug mb-4 font-display">
            "Maîtrisez votre stock,<br />pilotez votre activité."
          </blockquote>
          <p className="text-sm text-zinc-400">
            Gestion d'inventaire, achats, fabrication et qualité — tout en un.
          </p>
        </div>
        <div className="flex gap-6 text-xs text-zinc-600">
          <span>Stocks en temps réel</span>
          <span>·</span>
          <span>Traçabilité complète</span>
          <span>·</span>
          <span>Multi-sites</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="size-10 rounded-xl grid place-items-center" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
              <Boxes className="size-5 text-white" />
            </div>
            <span className="text-lg font-bold font-display" style={{ color: 'rgb(11 18 32)' }}>Inventaire Pro</span>
          </div>

          <h1 className="text-2xl font-bold font-display mb-1" style={{ color: 'rgb(11 18 32)' }}>Connexion</h1>
          <p className="text-sm mb-8" style={{ color: 'rgb(100 116 139)' }}>
            Accédez à votre espace de gestion.
          </p>

          {error && (
            <div className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: '#fdeaea', border: '1px solid #f5c2c4', color: 'rgb(229 72 77)' }}>
              {error === 'missing'
                ? 'Veuillez renseigner vos identifiants.'
                : error === 'locked'
                ? 'Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.'
                : 'Identifiants incorrects. Veuillez réessayer.'}
            </div>
          )}

          <form action={login} className="space-y-5">
            <input type="hidden" name="next" value={next ?? '/dashboard'} />
            <div>
              <label className="label" htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="vous@exemple.com"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Mot de passe</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 text-base">
              Se connecter
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: 'rgb(var(--muted))' }}>
            © {new Date().getFullYear()} Inventaire Pro — Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
