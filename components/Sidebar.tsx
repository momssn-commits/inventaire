'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Layers, Archive,
  Warehouse, MapPin, RefreshCw,
  Truck, Zap, ScanLine,
  Users, ShoppingCart,
  ClipboardList, Factory,
  ShieldCheck, Wrench, BarChart3,
  UsersRound, ScrollText, Building2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: 'Général',
    items: [
      { href: '/dashboard',   label: 'Tableau de bord',    icon: LayoutDashboard },
      { href: '/produits',    label: 'Produits',            icon: Package },
      { href: '/stock',       label: 'État',                icon: Layers },
      { href: '/lots',        label: 'Lots',                icon: Archive },
    ],
  },
  {
    label: 'Sites',
    items: [
      { href: '/entrepots',   label: 'Sites',               icon: Warehouse },
      { href: '/emplacements',label: 'Locaux',              icon: MapPin },
      { href: '/inventaire',  label: 'Inventaire cyclique', icon: RefreshCw },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { href: '/operations',  label: 'Mouvements',          icon: Truck },
      { href: '/reassort',    label: 'Réassort',            icon: Zap },
      { href: '/codes-barres',label: 'Codes-barres',        icon: ScanLine },
    ],
  },
  {
    label: 'Achats',
    items: [
      { href: '/partenaires', label: 'Fournisseurs',        icon: Users },
      { href: '/achats',      label: 'Commandes achat',     icon: ShoppingCart },
    ],
  },
  {
    label: 'Production',
    items: [
      { href: '/fabrication/bom', label: 'Nomenclatures',   icon: ClipboardList },
      { href: '/fabrication', label: 'Fabrication',         icon: Factory },
    ],
  },
  {
    label: 'Qualité & Analyse',
    items: [
      { href: '/qualite',     label: 'Qualité',             icon: ShieldCheck },
      { href: '/maintenance', label: 'Maintenance',         icon: Wrench },
      { href: '/rapports',    label: 'Rapports',            icon: BarChart3 },
    ],
  },
];

const adminGroup: Group = {
  label: 'Administration',
  items: [
    { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: UsersRound },
    { href: '/admin/audit',        label: 'Journal d\'audit', icon: ScrollText },
    { href: '/admin/societe',      label: 'Société',      icon: Building2 },
  ],
};

export function Sidebar({ companyName, isAdmin }: { companyName: string; isAdmin?: boolean }) {
  const pathname = usePathname();
  const allGroups = isAdmin ? [...groups, adminGroup] : groups;

  return (
    <aside
      className="hidden md:flex md:w-[248px] flex-col flex-shrink-0 sticky top-0 h-screen px-4 py-5 no-print"
      style={{ background: 'linear-gradient(180deg,#0b1220 0%,#0e1730 100%)', color: '#cbd5e1' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-2.5 pb-6">
        <div
          className="size-[38px] rounded-xl grid place-items-center text-white font-display font-bold text-base shrink-0"
          style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)', boxShadow: '0 6px 16px -4px rgba(37,99,235,.55)' }}
        >
          IP
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display font-semibold text-white text-[16.5px] truncate">Inventaire Pro</div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] truncate" style={{ color: '#64748b' }}>
            {companyName}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto -mx-1 px-1">
        {allGroups.map((g) => (
          <div key={g.label}>
            <div className="px-3 pt-[18px] pb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#475569' }}>
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active =
                  pathname === it.href ||
                  (it.href !== '/dashboard' && pathname.startsWith(it.href + '/'));
                return (
                  <li key={`${it.href}-${it.label}`}>
                    <Link
                      href={it.href}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                        active ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-100'
                      )}
                      style={
                        active
                          ? { background: 'linear-gradient(90deg,rgba(37,99,235,.22),rgba(37,99,235,.06))' }
                          : undefined
                      }
                    >
                      {active && (
                        <span
                          className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r"
                          style={{ background: 'linear-gradient(180deg,#4f8bff,#7c3aed)' }}
                        />
                      )}
                      <it.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Astuce */}
      <div
        className="mt-4 rounded-2xl p-3.5"
        style={{ background: 'linear-gradient(135deg,rgba(37,99,235,.25),rgba(124,58,237,.2))', border: '1px solid rgba(79,139,255,.25)' }}
      >
        <b className="block text-white text-[13.5px] mb-0.5">Astuce du jour</b>
        <p className="text-xs leading-snug" style={{ color: '#94a3b8' }}>
          Fixez des seuils d'alerte par produit pour anticiper les ruptures.
        </p>
      </div>
    </aside>
  );
}
