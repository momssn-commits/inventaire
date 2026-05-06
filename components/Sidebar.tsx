'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Warehouse, MapPin, ArrowLeftRight, Truck, ShoppingCart,
  Factory, ShieldCheck, ClipboardList, BarChart3, ScanLine, Wrench, RotateCcw,
  Users, Settings, Boxes, History, RefreshCw, Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type Group = { label: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; module?: string }[] };

const groups: Group[] = [
  {
    label: 'Vue d\'ensemble',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Données de référence',
    items: [
      { href: '/produits', label: 'Produits', icon: Package, module: 'M1' },
      { href: '/entrepots', label: 'Entrepôts', icon: Warehouse, module: 'M2' },
      { href: '/emplacements', label: 'Emplacements', icon: MapPin, module: 'M2' },
      { href: '/partenaires', label: 'Partenaires', icon: Users },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { href: '/operations', label: 'Mouvements', icon: ArrowLeftRight, module: 'M3' },
      { href: '/inventaire', label: 'Comptages', icon: ClipboardList, module: 'M2' },
      { href: '/reassort', label: 'Réassort', icon: RefreshCw, module: 'M4' },
      { href: '/codes-barres', label: 'Mode entrepôt', icon: ScanLine, module: 'M5' },
      { href: '/qualite', label: 'Qualité', icon: ShieldCheck, module: 'M6' },
    ],
  },
  {
    label: 'Achats & Production',
    items: [
      { href: '/achats', label: 'Achats', icon: ShoppingCart, module: 'M7' },
      { href: '/fabrication', label: 'Fabrication', icon: Factory, module: 'M8' },
      { href: '/maintenance', label: 'Maintenance', icon: Wrench, module: 'M9' },
      { href: '/reparations', label: 'Réparations', icon: RotateCcw, module: 'M11' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { href: '/rapports', label: 'Rapports', icon: BarChart3, module: 'M12' },
      { href: '/tracabilite', label: 'Traçabilité', icon: History },
      { href: '/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
];

export function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="size-9 rounded-lg bg-brand-600 grid place-items-center text-white">
          <Boxes className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight truncate">Inventaire</div>
          <div className="text-xs text-zinc-500 truncate">{companyName}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-2">
            <div className="px-5 py-1.5 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">{g.label}</div>
            <ul>
              {g.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + '/');
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition',
                        active
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300 font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                      )}
                    >
                      <it.icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.module && (
                        <span className="text-[10px] text-zinc-400 font-mono">{it.module}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <Link href="/codes-barres" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800">
          <Smartphone className="size-4" />
          Mode mobile entrepôt
        </Link>
      </div>
    </aside>
  );
}
