'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Search, LogOut, Menu, ChevronDown, Settings } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-4 md:px-8 py-3.5 no-print"
      style={{ background: 'rgba(245,247,251,.78)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(232,236,244,.9)' }}
    >
      <button className="md:hidden btn-ghost p-2"><Menu className="size-5" /></button>

      {/* Recherche */}
      <div className="relative flex-1 max-w-[440px] ml-auto">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'rgb(100 116 139)' }} />
        <input
          placeholder="Rechercher un produit, un SKU…"
          className="input pl-10 pr-20"
          aria-label="Recherche"
        />
        <kbd className="hidden sm:inline absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[11px] rounded-md px-1.5 py-0.5"
          style={{ border: '1px solid rgb(232 236 244)', borderBottomWidth: '2px', color: 'rgb(100 116 139)', background: 'rgb(245 247 251)' }}>
          ⌘K
        </kbd>
      </div>

      <ConnectionStatus />

      <button
        className="relative grid place-items-center size-10 rounded-xl transition"
        style={{ color: 'rgb(100 116 139)', background: '#fff', border: '1px solid rgb(232 236 244)', boxShadow: 'var(--shadow-sm)' }}
        aria-label="Notifications"
      >
        <Bell className="size-[19px]" />
        <span className="absolute top-2 right-2.5 size-[7px] rounded-full" style={{ background: 'rgb(229 72 77)', outline: '2px solid #fff' }} />
      </button>

      {/* Menu utilisateur */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl transition"
          style={{ background: '#fff', border: '1px solid rgb(232 236 244)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div
            className="size-[34px] rounded-full grid place-items-center text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#4f8bff,#a855f7)', outline: '2px solid rgba(79,139,255,.35)', outlineOffset: '2px' }}
          >
            {user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-[13.5px] font-semibold" style={{ color: 'rgb(11 18 32)' }}>{user.name}</span>
            <span className="text-[11.5px] capitalize" style={{ color: 'rgb(100 116 139)' }}>{user.role}</span>
          </div>
          <ChevronDown className="size-4 hidden md:block" style={{ color: 'rgb(100 116 139)' }} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 card p-1.5 z-40" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid rgb(232 236 244)' }}>
              <div className="text-sm font-semibold" style={{ color: 'rgb(11 18 32)' }}>{user.name}</div>
              <div className="text-xs truncate" style={{ color: 'rgb(100 116 139)' }}>{user.email}</div>
            </div>
            <Link href="/parametres" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-50" style={{ color: 'rgb(11 18 32)' }}>
              <Settings className="size-4" /> Paramètres
            </Link>
            <Link href="/api/auth/logout" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50" style={{ color: 'rgb(229 72 77)' }}>
              <LogOut className="size-4" /> Se déconnecter
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
