import { describe, it, expect } from 'vitest';
import type { PaymentMethodSetting } from '../types';

describe('Payment & USSD Safety Rules', () => {
  const sampleMtnSetting: PaymentMethodSetting = {
    id: 'mtn',
    is_active: true,
    merchant_code: '123456',
    account_name: 'Convivium Home Hotel',
    ussd_mode: 'full',
    instructions_fr: 'Composez le code...',
    instructions_en: 'Dial the code...',
    is_tested_on_device: false, // NOT tested yet!
  };

  const sampleOrangeSetting: PaymentMethodSetting = {
    id: 'orange',
    is_active: true,
    merchant_code: '654321',
    account_name: 'Convivium Home Hotel',
    ussd_mode: 'full',
    instructions_fr: 'Composez le code...',
    instructions_en: 'Dial the code...',
    is_tested_on_device: true, // Physically tested!
  };

  function generateUssd(setting: PaymentMethodSetting, amount: number) {
    const code = setting.merchant_code.trim();
    if (setting.id === 'mtn') {
      return setting.ussd_mode === 'full' ? `*126*14*${code}*${amount}#` : `*126#`;
    } else {
      return setting.ussd_mode === 'full' ? `#150*47*${code}*${amount}#` : `#150*47#`;
    }
  }

  function canAutoDial(setting: PaymentMethodSetting) {
    // Safety Rule: Only allow automated dialer when physically tested on device
    return setting.is_tested_on_device === true;
  }

  it('generates exact Cameroon USSD syntax using server amount', () => {
    const amount = 17500;
    const mtnUssd = generateUssd(sampleMtnSetting, amount);
    const orangeUssd = generateUssd(sampleOrangeSetting, amount);

    expect(mtnUssd).toBe('*126*14*123456*17500#');
    expect(orangeUssd).toBe('#150*47*654321*17500#');
  });

  it('disables automated dialing when format is not physically tested on device', () => {
    expect(canAutoDial(sampleMtnSetting)).toBe(false);
  });

  it('enables automated dialing only when verified as tested on real device', () => {
    expect(canAutoDial(sampleOrangeSetting)).toBe(true);
  });
});
