import { cn } from '@/lib/cn';

const palette: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  assigned: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  scheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  validated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  invoiced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  fail: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  new: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  action: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  quoted: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const labels: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmé',
  assigned: 'Affecté',
  in_progress: 'En cours',
  scheduled: 'Planifié',
  done: 'Terminé',
  validated: 'Validé',
  pass: 'Conforme',
  fail: 'Non conforme',
  pending: 'En attente',
  cancelled: 'Annulé',
  new: 'Nouveau',
  resolved: 'Résolu',
  action: 'Action engagée',
  received: 'Reçu',
  invoiced: 'Facturé',
  sent: 'Envoyé',
  quoted: 'Devis émis',
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('badge', palette[value] ?? 'bg-zinc-100 text-zinc-700', className)}>
      {labels[value] ?? value}
    </span>
  );
}
