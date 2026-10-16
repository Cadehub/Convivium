import { describe, it, expect } from 'vitest';
import { translations } from '../i18n/translations';

describe('Internationalization (FR / EN) Completeness', () => {
  it('contains identical keys in both French and English dictionaries', () => {
    const frKeys = Object.keys(translations.fr);
    const enKeys = Object.keys(translations.en);

    expect(frKeys.sort()).toEqual(enKeys.sort());
  });

  it('has non-empty string values for all translated keys', () => {
    Object.entries(translations.fr).forEach(([key, val]) => {
      expect(typeof val, `French key ${key} should be a string`).toBe('string');
      expect(val.trim().length, `French key ${key} should not be empty`).toBeGreaterThan(0);
    });

    Object.entries(translations.en).forEach(([key, val]) => {
      expect(typeof val, `English key ${key} should be a string`).toBe('string');
      expect(val.trim().length, `English key ${key} should not be empty`).toBeGreaterThan(0);
    });
  });

  it('correctly uses XAF as currency code in both languages', () => {
    expect(translations.fr.currency).toBe('XAF');
    expect(translations.en.currency).toBe('XAF');
  });
});
