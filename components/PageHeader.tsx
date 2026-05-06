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
    <div className="flex items-start gap-3 justify-between mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {module && (
            <span className="badge bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              {module}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 no-print">{actions}</div>}
    </div>
  );
}
