import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="mx-auto size-12 rounded-full bg-zinc-100 dark:bg-zinc-800 grid place-items-center mb-4">
          <Icon className="size-6 text-zinc-500" />
        </div>
      )}
      <div className="text-base font-medium">{title}</div>
      {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
