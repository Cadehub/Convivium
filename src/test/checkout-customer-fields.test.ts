import { describe, it, expect } from 'vitest';
import { translations } from '../i18n/translations';

describe('Checkout Customer Fields & Delivery Phone Validation', () => {
  // Pure logic replica of checkout validation rule
  function validateCheckoutSubmission(input: {
    orderMode: 'dine_in' | 'room_service' | 'delivery';
    locationDetail: string;
    customerPhone?: string;
  }): { isValid: boolean; errorKey?: string } {
    if (input.orderMode === 'room_service' && !input.locationDetail.trim()) {
      return { isValid: false, errorKey: 'roomNumber' };
    }
    if (input.orderMode === 'delivery' && !input.locationDetail.trim()) {
      return { isValid: false, errorKey: 'deliveryAddress' };
    }
    // Phone is mandatory ONLY for delivery
    if (input.orderMode === 'delivery') {
      const trimmed = (input.customerPhone || '').trim();
      if (!trimmed) {
        return { isValid: false, errorKey: 'errorDeliveryPhoneRequired' };
      }
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length < 8) {
        return { isValid: false, errorKey: 'errorInvalidPhone' };
      }
    }
    return { isValid: true };
  }

  // Pure logic replica of RPC defaulting customer_name
  function resolveOrderCustomerName(providedName?: string): string {
    return (providedName && providedName.trim()) ? providedName.trim() : 'Client';
  }

  it('allows dine_in orders without phone number', () => {
    const result = validateCheckoutSubmission({
      orderMode: 'dine_in',
      locationDetail: 'Table 4',
      customerPhone: '',
    });
    expect(result.isValid).toBe(true);
    expect(result.errorKey).toBeUndefined();
  });

  it('allows room_service orders without phone number', () => {
    const result = validateCheckoutSubmission({
      orderMode: 'room_service',
      locationDetail: 'Chambre 204',
      customerPhone: '',
    });
    expect(result.isValid).toBe(true);
    expect(result.errorKey).toBeUndefined();
  });

  it('rejects delivery orders when phone number is missing or empty', () => {
    const resultEmpty = validateCheckoutSubmission({
      orderMode: 'delivery',
      locationDetail: 'Akwa, Rue des Palmiers',
      customerPhone: '',
    });
    expect(resultEmpty.isValid).toBe(false);
    expect(resultEmpty.errorKey).toBe('errorDeliveryPhoneRequired');

    const resultWhitespace = validateCheckoutSubmission({
      orderMode: 'delivery',
      locationDetail: 'Akwa, Rue des Palmiers',
      customerPhone: '   ',
    });
    expect(resultWhitespace.isValid).toBe(false);
    expect(resultWhitespace.errorKey).toBe('errorDeliveryPhoneRequired');
  });

  it('rejects delivery orders when phone number has fewer than 8 digits', () => {
    const resultShort = validateCheckoutSubmission({
      orderMode: 'delivery',
      locationDetail: 'Bonapriso, face station Total',
      customerPhone: '12345',
    });
    expect(resultShort.isValid).toBe(false);
    expect(resultShort.errorKey).toBe('errorInvalidPhone');
  });

  it('accepts delivery orders when valid phone number is provided', () => {
    const result = validateCheckoutSubmission({
      orderMode: 'delivery',
      locationDetail: 'Bonapriso, face station Total',
      customerPhone: '699112233',
    });
    expect(result.isValid).toBe(true);
  });

  it('defaults customer name to "Client" when not provided', () => {
    expect(resolveOrderCustomerName()).toBe('Client');
    expect(resolveOrderCustomerName('')).toBe('Client');
    expect(resolveOrderCustomerName('   ')).toBe('Client');
    expect(resolveOrderCustomerName('Custom Name')).toBe('Custom Name');
  });

  it('has bilingual translations for errorDeliveryPhoneRequired', () => {
    expect(translations.fr.errorDeliveryPhoneRequired).toBeDefined();
    expect(translations.fr.errorDeliveryPhoneRequired.length).toBeGreaterThan(0);
    expect(translations.en.errorDeliveryPhoneRequired).toBeDefined();
    expect(translations.en.errorDeliveryPhoneRequired.length).toBeGreaterThan(0);
  });
});
