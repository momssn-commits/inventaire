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
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6 gap-3">
          <div className="size-12 rounded-xl bg-brand-600 grid place-items-center text-white shadow-lg shadow-brand-600/30">
            <Boxes className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Inventaire</h1>
            <p className="text-xs text-zinc-500">Gestion professionnelle</p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1">Connexion</h2>
          <p className="text-sm text-zinc-500 mb-5">Accédez à votre espace de gestion d'inventaire.</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error === 'missing' ? 'Veuillez renseigner vos identifiants.' : 'Identifiants incorrects.'}
            </div>
          )}

          <form action={login} className="space-y-4">
            <input type="hidden" name="next" value={next ?? '/dashboard'} />
            <div>
              <label className="label" htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                defaultValue="admin@inventaire.fr"
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
                className="input"
                defaultValue="admin123"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Se connecter</button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 mb-2">Compte administrateur initial :</p>
            <ul className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>• <code className="text-[11px]">admin@inventaire.fr</code> / admin123</li>
            </ul>
            <p className="text-[11px] text-zinc-400 mt-2 italic">
              Pensez à modifier le mot de passe après la première connexion.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-6">
          © {new Date().getFullYear()} Inventaire — CDC-INVENTAIRE-V1.0
        </p>
      </div>
    </div>
  );
}
