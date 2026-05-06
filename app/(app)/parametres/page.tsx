import { Settings, User, Shield, Globe, Database, Cog, FileCode } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { ApiSection } from '@/components/ApiSection';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireSession();
  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  const users = await prisma.user.findMany({
    where: { companyId: session.companyId, deletedAt: null },
    orderBy: { name: 'asc' },
  });
  const recentLogs = await prisma.auditLog.findMany({
    where: { companyId: session.companyId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration globale, utilisateurs, sécurité, audit"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 grid place-items-center">
              <Settings className="size-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">Société</h3>
          </div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-zinc-500">Nom</dt><dd className="font-medium">{company?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Code</dt><dd className="font-mono">{company?.code}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Devise</dt><dd className="font-medium">{company?.currency}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Locale</dt><dd className="font-medium">{company?.locale}</dd></div>
          </dl>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 grid place-items-center">
              <Shield className="size-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold">Sécurité</h3>
          </div>
          <ul className="text-sm space-y-2">
            <li>✅ Chiffrement HTTPS / TLS 1.3</li>
            <li>✅ Mots de passe bcrypt (10 rounds)</li>
            <li>✅ Sessions JWT signées (HS256)</li>
            <li>✅ Cookies HttpOnly + SameSite</li>
            <li>✅ Audit-trail complet</li>
            <li>✅ RBAC (admin / manager / operator / user)</li>
            <li>✅ Soft-delete sur les entités</li>
            <li>⚙️ 2FA / SSO (configurable)</li>
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-lg bg-violet-100 dark:bg-violet-950/40 grid place-items-center">
              <Globe className="size-5 text-violet-600" />
            </div>
            <h3 className="font-semibold">Internationalisation</h3>
          </div>
          <ul className="text-sm space-y-2">
            <li>🇫🇷 Français (par défaut)</li>
            <li>🇬🇧 English (à activer)</li>
            <li>🇪🇸 Español (à activer)</li>
            <li>🇸🇦 العربية (RTL, à activer)</li>
            <li className="pt-2 text-xs text-zinc-500">Multi-devises avec taux de change automatiques</li>
          </ul>
        </div>
      </div>

      <div className="mb-4">
        <ApiSection />
      </div>

      <div className="card overflow-x-auto mb-4">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><User className="size-4" /> Utilisateurs</h3>
          <span className="text-xs text-zinc-500">{users.length} utilisateur(s)</span>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôle</th>
              <th>2FA</th>
              <th>Dernière connexion</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-sm">{u.email}</td>
                <td>
                  <span className="badge bg-zinc-100 dark:bg-zinc-800 text-xs capitalize">{u.role}</span>
                </td>
                <td>{u.twoFactor ? '✅' : '—'}</td>
                <td className="text-sm">{formatDate(u.lastLoginAt)}</td>
                <td>
                  <span className={`badge text-xs ${u.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-100 text-red-700'}`}>
                    {u.active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto mb-4">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><FileCode className="size-4" /> Journal d'audit (20 dernières actions)</h3>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Entité</th>
              <th>ID entité</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-sm text-zinc-500 py-6">Aucune action enregistrée.</td></tr>
            ) : recentLogs.map((log) => (
              <tr key={log.id}>
                <td className="text-sm">{formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('fr-FR')}</td>
                <td className="text-sm">{log.user?.name ?? '—'}</td>
                <td><span className="badge bg-zinc-100 dark:bg-zinc-800 text-xs">{log.action}</span></td>
                <td className="text-sm">{log.entity}</td>
                <td className="text-xs font-mono text-zinc-500 truncate max-w-[200px]">{log.entityId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Cog className="size-5 text-zinc-600" />
            <h3 className="font-semibold">Architecture technique</h3>
          </div>
          <ul className="text-sm space-y-1.5">
            <li><strong>Frontend</strong> : Next.js 15 (App Router) + React 18 + TypeScript</li>
            <li><strong>UI</strong> : Tailwind CSS + Lucide</li>
            <li><strong>Backend</strong> : Next.js Server Actions + API Routes</li>
            <li><strong>Base de données</strong> : Prisma + SQLite (PostgreSQL en production)</li>
            <li><strong>Auth</strong> : JWT (jose) + bcrypt</li>
            <li><strong>Charts</strong> : Recharts</li>
            <li><strong>Codes-barres</strong> : BarcodeDetector API + GS1 parser</li>
            <li><strong>PWA</strong> : manifest + service worker</li>
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Database className="size-5 text-zinc-600" />
            <h3 className="font-semibold">Conformité au cahier des charges</h3>
          </div>
          <ul className="text-sm space-y-1.5">
            <li>✅ M1 — Gestion des produits (variantes, lots, SN, valorisation)</li>
            <li>✅ M2 — Multi-entrepôts, emplacements arborescents, comptages</li>
            <li>✅ M3 — Réception/expédition, transferts, mouvements atomiques</li>
            <li>✅ M4 — Réassort min/max + génération PO automatique</li>
            <li>✅ M5 — Codes-barres GS1 (AI 01, 10, 17, 21, 30) + scan caméra</li>
            <li>✅ M6 — Points de contrôle qualité + alertes</li>
            <li>✅ M7 — Achats avec workflow draft → sent → received</li>
            <li>✅ M8 — Fabrication (BOM, OF, postes de travail)</li>
            <li>✅ M9 — Maintenance (équipements + interventions)</li>
            <li>✅ M11 — Réparations</li>
            <li>✅ M12 — Tableaux de bord, rapports, traçabilité</li>
            <li>✅ Multi-tenant, audit-trail, soft-delete</li>
            <li>✅ PWA installable, mode entrepôt mobile</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
