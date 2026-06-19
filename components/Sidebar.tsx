'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Layers, Archive,
  Warehouse, MapPin, RefreshCw,
  Truck, Zap, ScanLine,
  Users, ShoppingCart,
  ClipboardList, Factory,
  ShieldCheck, Wrench,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string; // Tailwind bg color for the icon badge
};

type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: 'Stock',
    items: [
      { href: '/dashboard',   label: 'Tableau de bord',    icon: LayoutDashboard, badge: 'bg-indigo-500' },
      { href: '/produits',    label: 'Produits',            icon: Package,         badge: 'bg-amber-500' },
      { href: '/stock',       label: 'État des stocks',     icon: Layers,          badge: 'bg-orange-600' },
      { href: '/lots',        label: 'Lots',                icon: Archive,         badge: 'bg-blue-500' },
    ],
  },
  {
    label: 'Entrepôts',
    items: [
      { href: '/entrepots',   label: 'Entrepôts',           icon: Warehouse,       badge: 'bg-orange-500' },
      { href: '/emplacements',label: 'Emplacements',        icon: MapPin,          badge: 'bg-rose-500' },
      { href: '/inventaire',  label: 'Inventaire cyclique', icon: RefreshCw,       badge: 'bg-teal-500' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { href: '/operations',  label: 'Mouvements',          icon: Truck,           badge: 'bg-orange-500' },
      { href: '/reassort',    label: 'Réassort',            icon: Zap,             badge: 'bg-yellow-500' },
      { href: '/codes-barres',label: 'Codes-barres',        icon: ScanLine,        badge: 'bg-slate-500' },
    ],
  },
  {
    label: 'Achats',
    items: [
      { href: '/partenaires', label: 'Fournisseurs',        icon: Users,           badge: 'bg-amber-600' },
      { href: '/achats',      label: 'Commandes achat',     icon: ShoppingCart,    badge: 'bg-slate-500' },
    ],
  },
  {
    label: 'Production',
    items: [
      { href: '/fabrication', label: 'Nomenclatures',       icon: ClipboardList,   badge: 'bg-zinc-500' },
      { href: '/fabrication', label: 'Fabrication',         icon: Factory,         badge: 'bg-zinc-600' },
    ],
  },
  {
    label: 'Qualité & Maintenance',
    items: [
      { href: '/qualite',     label: 'Qualité',             icon: ShieldCheck,     badge: 'bg-emerald-500' },
      { href: '/maintenance', label: 'Maintenance',         icon: Wrench,          badge: 'bg-slate-400' },
    ],
  },
];

export function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex md:w-60 lg:w-64 flex-col flex-shrink-0"
      style={{ background: 'rgb(10 11 22)', borderRight: '1px solid rgb(30 33 52)' }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgb(30 33 52)' }}>
        <div className="size-8 rounded-lg bg-indigo-600 grid place-items-center shrink-0">
          <Package className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-white leading-tight">Inventaire</div>
          <div className="text-[10px] text-zinc-500 truncate">{companyName}</div>
        </div>
      </div>

      {/* Back link */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 mx-3 mt-3 mb-1 px-2 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition"
      >
        <ChevronLeft className="size-3.5" />
        Retour Workflow
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g.label} className="mt-4">
            <div
              className="px-2 mb-1 text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'rgb(75 80 105)' }}
            >
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
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all',
                        active
                          ? 'text-white'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                      )}
                      style={active ? { background: 'rgba(99,102,241,0.18)' } : {}}
                    >
                      {/* Colored icon badge */}
                      <span
                        className={cn(
                          'size-6 rounded-md grid place-items-center shrink-0 text-white',
                          it.badge
                        )}
                      >
                        <it.icon className="size-3.5" />
                      </span>
                      <span className="truncate">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
