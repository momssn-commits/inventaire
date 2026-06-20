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
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    redirect('/login?error=invalid');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: { increment: 1 } },
    });
    redirect('/login?error=invalid');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedAttempts: 0 },
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
          <div className="size-10 rounded-xl bg-indigo-600 grid place-items-center shadow-lg shadow-indigo-900/50">
            <Boxes className="size-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Inventaire Pro</span>
        </div>
        <div>
          <blockquote className="text-2xl font-semibold text-white leading-snug mb-4">
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
          <span>Multi-entrepôts</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="size-10 rounded-xl bg-indigo-600 grid place-items-center">
              <Boxes className="size-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Inventaire Pro</span>
          </div>

          <h1 className="text-2xl font-semibold text-white mb-1">Connexion</h1>
          <p className="text-sm mb-8" style={{ color: 'rgb(var(--muted))' }}>
            Accédez à votre espace de gestion.
          </p>

          {error && (
            <div className="mb-5 rounded-lg bg-red-950/40 border border-red-900/60 px-4 py-3 text-sm text-red-300">
              {error === 'missing' ? 'Veuillez renseigner vos identifiants.' : 'Identifiants incorrects. Veuillez réessayer.'}
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
