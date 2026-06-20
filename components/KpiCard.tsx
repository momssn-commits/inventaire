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
  const iconClass = {
    default: 'bg-zinc-800 text-zinc-300',
    success: 'bg-emerald-950/60 text-emerald-400',
    warning: 'bg-amber-950/60 text-amber-400',
    danger: 'bg-red-950/60 text-red-400',
    info: 'bg-indigo-950/60 text-indigo-400',
  }[tone];

  const valueClass = {
    default: 'text-white',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-red-300',
    info: 'text-indigo-300',
  }[tone];

  return (
    <div className="card p-5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
          <div className={cn('mt-2 text-xl font-bold tracking-tight tabular-nums leading-tight truncate', valueClass)} title={String(value)}>{value}</div>
          {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
          {delta && <div className="mt-1 text-xs text-zinc-500">{delta}</div>}
        </div>
        <div className={cn('size-10 rounded-xl grid place-items-center shrink-0', iconClass)}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
