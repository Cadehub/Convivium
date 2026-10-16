import { describe, it, expect } from 'vitest';
import { formatXAF, formatDateTime } from '../lib/formatters';

describe('Formatters — XAF & Africa/Douala Timezone', () => {
  it('formats amounts in XAF integer without decimals', () => {
    expect(formatXAF(5000)).toMatch(/5\s?000\sXAF/);
    expect(formatXAF(0)).toBe('0 XAF');
    expect(formatXAF(12500)).toMatch(/12\s?500\sXAF/);
    // Decimals must be rounded to nearest integer
    expect(formatXAF(4500.85)).toMatch(/4\s?501\sXAF/);
  });

  it('formats dates in Africa/Douala timezone', () => {
    // 2026-10-16 12:00:00 UTC = 13:00:00 in Africa/Douala (UTC+1)
    const utcDateStr = '2026-10-16T12:00:00Z';
    const formattedFr = formatDateTime(utcDateStr, 'fr');
    expect(formattedFr).toContain('13:00');
    expect(formattedFr).toContain('2026');

    const formattedEn = formatDateTime(utcDateStr, 'en');
    expect(formattedEn).toContain('13:00');
    expect(formattedEn).toContain('2026');
  });

  it('handles invalid date inputs safely', () => {
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime('invalid-date')).toBe('-');
  });
});
