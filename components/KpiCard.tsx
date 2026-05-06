import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  hint?: string;
}) {
  const toneClass = {
    default: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  }[tone];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums truncate">{value}</div>
          {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
          {delta && <div className="mt-1 text-xs text-zinc-500">{delta}</div>}
        </div>
        <div className={cn('size-10 rounded-lg grid place-items-center', toneClass)}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
