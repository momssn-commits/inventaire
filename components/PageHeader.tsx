import { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  module,
  actions,
}: {
  title: string;
  subtitle?: string;
  module?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2 shrink-0 no-print">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm mt-1" style={{ color: 'rgb(148 155 180)' }}>{subtitle}</p>}
    </div>
  );
}
