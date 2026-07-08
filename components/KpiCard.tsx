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
    default: 'i-blue',
    info: 'i-blue',
    success: 'i-green',
    warning: 'i-amber',
    danger: 'i-red',
  }[tone];

  return (
    <div className="card p-5 transition hover:-translate-y-[3px] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between mb-3.5">
        <div className={cn('grid place-items-center size-10 rounded-xl', iconClass)}>
          <Icon className="size-[19px]" />
        </div>
        {delta && <span className="trend t-flat">{delta}</span>}
      </div>
      <div className="text-[22px] xl:text-[25px] font-bold font-display leading-none tabular-nums truncate" title={String(value)}>
        {value}
      </div>
      <div className="text-[13px] font-medium mt-1.5" style={{ color: 'rgb(100 116 139)' }}>{label}</div>
      {hint && <div className="text-xs mt-1" style={{ color: 'rgb(100 116 139)' }}>{hint}</div>}
    </div>
  );
}
