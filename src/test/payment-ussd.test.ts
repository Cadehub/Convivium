import { describe, it, expect } from 'vitest';
import type { PaymentMethodSetting } from '../types';

describe('Payment & USSD Safety Rules', () => {
  const sampleMtnSetting: PaymentMethodSetting = {
    id: 'mtn',
    is_active: true,
    merchant_code: '670000000',
    phone_number: '670000000',
    account_name: 'Convivium Home Hotel MoMo',
    ussd_mode: 'full',
    instructions_fr: 'Composez le *126#...',
    instructions_en: 'Dial *126#...',
    is_tested_on_device: false, // Default: safe fallback flow (*126# menu + copy)
  };

  const sampleOrangeSetting: PaymentMethodSetting = {
    id: 'orange',
    is_active: true,
    merchant_code: '654321',
    account_name: 'Convivium Home Hotel',
    ussd_mode: 'full',
    instructions_fr: 'Composez le code...',
    instructions_en: 'Dial the code...',
    is_tested_on_device: true, // Merchant code tested
  };

  function generateUssd(setting: PaymentMethodSetting, amount: number) {
    if (setting.id === 'mtn') {
      const phone = (setting.phone_number || setting.merchant_code || '').trim();
      // P2P MTN MoMo transfer string if fully tested on handset, otherwise fallback menu *126#
      return setting.ussd_mode === 'full' && setting.is_tested_on_device
        ? `*126*1*1*${phone}*${amount}#`
        : `*126#`;
    } else {
      const code = setting.merchant_code.trim();
      return setting.ussd_mode === 'full' ? `#150*47*${code}*${amount}#` : `#150*47#`;
    }
  }

  function canAutoDial(setting: PaymentMethodSetting) {
    // Safety Rule: Only allow automated single-string dialing when physically tested on device
    return setting.is_tested_on_device === true;
  }

  it('generates standard safe MTN fallback menu and Orange merchant code USSD', () => {
    const amount = 17500;
    const mtnUssd = generateUssd(sampleMtnSetting, amount);
    const orangeUssd = generateUssd(sampleOrangeSetting, amount);

    // MTN safely falls back to official *126# menu to avoid unverified carrier shortcuts
    expect(mtnUssd).toBe('*126#');
    // Orange uses the official verified merchant code format
    expect(orangeUssd).toBe('#150*47*654321*17500#');
  });

  it('supports direct MTN P2P string only if explicitly tested and enabled on real device', () => {
    const testedMtnSetting: PaymentMethodSetting = {
      ...sampleMtnSetting,
      is_tested_on_device: true,
    };
    const mtnUssd = generateUssd(testedMtnSetting, 17500);
    expect(mtnUssd).toBe('*126*1*1*670000000*17500#');
  });

  it('disables automated dialing when format is not physically tested on device', () => {
    expect(canAutoDial(sampleMtnSetting)).toBe(false);
  });

  it('enables automated dialing only when verified as tested on real device', () => {
    expect(canAutoDial(sampleOrangeSetting)).toBe(true);
  });
});

