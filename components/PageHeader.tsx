import { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  count,
  module,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  count?: string | number;
  module?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="text-[30px] font-bold font-display leading-tight">
          {title}
          {count !== undefined && count !== null && <span className="count-pill align-[6px] ml-2.5">{count}</span>}
        </h1>
        {subtitle && <p className="text-[14.5px] mt-1.5" style={{ color: 'rgb(100 116 139)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 no-print">{actions}</div>}
    </div>
  );
}
