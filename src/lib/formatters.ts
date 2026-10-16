/**
 * Utility formatters for Convivium Home Hotel
 * - Currency: XAF (Franc CFA), integer amounts only, no decimals.
 * - Timezone: Africa/Douala (UTC+1).
 */

export function formatXAF(amount: number): string {
  const safeAmount = Math.round(Number(amount) || 0);
  // French-style space thousand separator
  return new Intl.NumberFormat('fr-CM', {
    style: 'decimal',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safeAmount) + ' XAF';
}

export function formatDateTime(dateInput: string | Date, locale: 'fr' | 'en' = 'fr'): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      timeZone: 'Africa/Douala',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatRelativeTime(dateInput: string | Date, locale: 'fr' | 'en' = 'fr'): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) {
    return locale === 'fr' ? "À l'instant" : 'Just now';
  }
  if (diffInMinutes < 60) {
    return locale === 'fr' ? `Il y a ${diffInMinutes} min` : `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return locale === 'fr' ? `Il y a ${diffInHours} h` : `${diffInHours}h ago`;
  }
  return formatDateTime(date, locale);
}
