import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export function Pagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;

  const prev = page - 1;
  const next = page + 1;

  // Fenêtre de pages visibles : toujours 1, toujours last, et ±2 autour de la page courante
  const shown = new Set<number>();
  shown.add(1);
  shown.add(totalPages);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) shown.add(i);
  const pages = Array.from(shown).sort((a, b) => a - b);

  return (
    <nav className="flex items-center justify-center gap-1 mt-4" aria-label="Pagination">
      <Link
        href={buildHref(prev)}
        aria-disabled={page <= 1}
        className={`p-2 rounded-lg transition-colors ${
          page <= 1
            ? 'text-zinc-300 dark:text-zinc-700 pointer-events-none'
            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <ChevronLeft className="size-4" />
      </Link>

      {pages.map((p, i) => {
        const gap = i > 0 && p - pages[i - 1] > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {gap && <span className="px-1 text-zinc-400 text-sm select-none">…</span>}
            <Link
              href={buildHref(p)}
              className={`min-w-[2rem] h-8 px-2 flex items-center justify-center rounded-lg text-sm transition-colors ${
                p === page
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {p}
            </Link>
          </span>
        );
      })}

      <Link
        href={buildHref(next)}
        aria-disabled={page >= totalPages}
        className={`p-2 rounded-lg transition-colors ${
          page >= totalPages
            ? 'text-zinc-300 dark:text-zinc-700 pointer-events-none'
            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
