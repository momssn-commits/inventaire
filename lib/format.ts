export const DEFAULT_CURRENCY = 'XOF';
export const DEFAULT_LOCALE = 'fr-FR';

export function formatMoney(
  value: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE
): string {
  // FCFA n'a pas de décimales en pratique
  const fractionDigits = currency === 'XOF' || currency === 'XAF' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Montant compact pour les KPI : 1 250 000 → « 1,25 M », 188 886 373 → « 188,9 M ». */
export function formatMoneyShort(
  value: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE
): string {
  const sym = currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
  const abs = Math.abs(value);
  const nf = (v: number, d: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: d }).format(v);
  if (abs >= 1_000_000_000) return `${nf(value / 1_000_000_000, 1)} Md ${sym}`;
  if (abs >= 1_000_000) return `${nf(value / 1_000_000, 1)} M ${sym}`;
  if (abs >= 10_000) return `${nf(value / 1_000, 0)} k ${sym}`;
  return formatMoney(value, currency, locale);
}

export function formatNumber(value: number, decimals = 2, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(d: Date | string | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(d: Date | string, locale = DEFAULT_LOCALE): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 2592000) return rtf.format(-Math.round(diff / 86400), 'day');
  if (diff < 31536000) return rtf.format(-Math.round(diff / 2592000), 'month');
  return rtf.format(-Math.round(diff / 31536000), 'year');
}
