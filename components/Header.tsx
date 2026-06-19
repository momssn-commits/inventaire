'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Search, LogOut, Menu, ChevronDown } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 sticky top-0 z-30 backdrop-blur flex items-center px-4 md:px-6 gap-3 no-print" style={{ background: 'rgba(13,15,29,0.85)', borderBottom: '1px solid rgb(38,42,62)' }}>
      <button className="md:hidden btn-ghost p-2"><Menu className="size-5" /></button>

      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            placeholder="Rechercher un produit, lot, commande, BR..."
            className="input pl-9"
          />
          <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ border: '1px solid rgb(38,42,62)', color: 'rgb(148,155,180)', fontSize: '10px' }}>⌘K</kbd>
        </div>
      </div>

      <ConnectionStatus />

      <button className="btn-ghost p-2" aria-label="Notifications">
        <Bell className="size-5" />
      </button>

      <div className="relative">
        <button onClick={() => setOpen(!open)} className="btn-ghost flex items-center gap-2 px-2">
          <div className="size-8 rounded-full bg-indigo-600 grid place-items-center text-white text-sm font-medium">
            {user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-zinc-100">{user.name}</span>
            <span className="text-[11px] capitalize" style={{ color: 'rgb(148,155,180)' }}>{user.role}</span>
          </div>
          <ChevronDown className="size-4 text-zinc-400 hidden md:block" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 card p-1 shadow-lg z-40">
            <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid rgb(38,42,62)' }}>
              <div className="text-sm font-medium text-zinc-100">{user.name}</div>
              <div className="text-xs truncate" style={{ color: 'rgb(148,155,180)' }}>{user.email}</div>
            </div>
            <Link href="/parametres" className="block px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded">Paramètres</Link>
            <Link href="/api/auth/logout" className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 rounded">
              <LogOut className="size-4" /> Se déconnecter
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
