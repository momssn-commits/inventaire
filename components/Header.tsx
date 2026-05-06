'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, Search, Sun, Moon, LogOut, Menu, ChevronDown } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  // Initial state à `null` pour éviter le mismatch d'hydratation : on lit la classe
  // du <html> uniquement après le montage côté client.
  const [dark, setDark] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('inv-theme', next ? 'dark' : 'light');
    } catch {}
  }

  return (
    <header className="h-16 sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 md:px-6 gap-3 no-print">
      <button className="md:hidden btn-ghost p-2"><Menu className="size-5" /></button>

      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            placeholder="Rechercher un produit, lot, commande, BR..."
            className="input pl-9"
          />
          <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">⌘K</kbd>
        </div>
      </div>

      <ConnectionStatus />

      <button className="btn-ghost p-2" aria-label="Notifications">
        <Bell className="size-5" />
      </button>
      <button className="btn-ghost p-2" onClick={toggleTheme} aria-label="Thème" suppressHydrationWarning>
        {dark === true ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <div className="relative">
        <button onClick={() => setOpen(!open)} className="btn-ghost flex items-center gap-2 px-2">
          <div className="size-8 rounded-full bg-brand-600 grid place-items-center text-white text-sm font-medium">
            {user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-[11px] text-zinc-500 capitalize">{user.role}</span>
          </div>
          <ChevronDown className="size-4 text-zinc-400 hidden md:block" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 card p-1 shadow-lg z-40">
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-zinc-500 truncate">{user.email}</div>
            </div>
            <Link href="/parametres" className="block px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">Paramètres</Link>
            <Link href="/api/auth/logout" className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded">
              <LogOut className="size-4" /> Se déconnecter
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
