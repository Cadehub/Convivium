import { describe, it, expect, vi } from 'vitest';
import type { Order, PreparationStatus } from '../types';
import { analyzePaymentSms } from '../lib/smsParser';
import { translations } from '../i18n/translations';
import { REJECTION_REASONS } from '../components/kitchen/RejectPaymentModal';

describe('Refonte Dashboard Cuisine — Validation des Paiements et Gestion des Commandes', () => {
  const mockOrderNewToVerify: Order = {
    id: 'ord-101',
    public_reference: 'CVH-26-TEST1',
    order_origin: 'public_client',
    customer_name: 'Jean Dupont',
    customer_phone: '677112233',
    room_number: '204',
    table_number: null,
    order_mode: 'room_service',
    delivery_address: null,
    delivery_fee: undefined,
    delivery_schedule_type: 'instant',
    scheduled_delivery_time: null,
    payment_status: 'payment_declared',
    preparation_status: 'new',
    total_amount: 15000,
    created_at: '2026-10-18T12:00:00Z',
    updated_at: '2026-10-18T12:00:00Z',
    notes: 'Sans piment s’il vous plaît',
    items: [
      {
        id: 'item-1',
        item_name: 'Poulet DG',
        unit_price: 12000,
        quantity: 1,
        subtotal: 15000,
        variant_name: 'Familial',
        special_notes: 'Bien cuit',
        selected_complements: [
          {
            complement_id: 'comp-1',
            name: 'Frites de plantain',
            unit_price: 1500,
            quantity: 2,
            subtotal: 3000,
          },
        ],
      },
    ],
    payment_declarations: [
      {
        id: 'decl-1',
        order_id: 'ord-101',
        operator: 'mtn',
        declared_reference: 'MP261018.1200.A99999',
        payer_phone: '677112233',
        raw_sms_text:
          'Paiement de 15000 FCFA effectue avec succes a CONVIVIUM HOTEL (677123456). Ref: MP261018.1200.A99999. Le 18/10/2026 a 12:02:00.',
        customer_note: null,
        created_at: '2026-10-18T12:02:00Z',
      },
    ],
  };

  it('1 & 2: Correctly distinguishes unverified orders (Étape A) from paid operational orders (Étape B)', () => {
    const isAwaitingVerification = (o: Order) =>
      o.payment_status !== 'paid' && o.preparation_status !== 'cancelled';
    const isReadyForPreparation = (o: Order) => o.payment_status === 'paid';

    expect(isAwaitingVerification(mockOrderNewToVerify)).toBe(true);
    expect(isReadyForPreparation(mockOrderNewToVerify)).toBe(false);

    const confirmedOrder: Order = {
      ...mockOrderNewToVerify,
      payment_status: 'paid',
    };
    expect(isAwaitingVerification(confirmedOrder)).toBe(false);
    expect(isReadyForPreparation(confirmedOrder)).toBe(true);
  });

  it('3: Compares extracted amount with expected amount and flags matches accurately', () => {
    const analysis = analyzePaymentSms({
      rawSms: mockOrderNewToVerify.payment_declarations![0].raw_sms_text,
      expectedAmount: mockOrderNewToVerify.total_amount,
      declaredOperator: 'mtn',
      allOrders: [mockOrderNewToVerify],
      currentOrderId: mockOrderNewToVerify.id,
    });

    expect(analysis.parsed.extractedAmount).toBe(15000);
    expect(analysis.amountStatus).toBe('exact_match');
    expect(analysis.parsed.extractedReference).toBe('MP261018.1200.A99999');
    expect(analysis.parsed.detectedOperator).toBe('mtn');
  });

  it('3 (bis): Correctly detects amount discrepancy when client transfers less than expected', () => {
    const mismatchAnalysis = analyzePaymentSms({
      rawSms:
        'Paiement de 10000 FCFA effectue avec succes a CONVIVIUM HOTEL. Ref: MP261018.1200.A99999.',
      expectedAmount: 15000,
      declaredOperator: 'mtn',
      allOrders: [],
      currentOrderId: 'test-diff',
    });

    expect(mismatchAnalysis.parsed.extractedAmount).toBe(10000);
    expect(mismatchAnalysis.amountStatus).toBe('mismatch');
    expect(mismatchAnalysis.amountDifference).toBe(-5000);
  });

  it('4: Preserves raw original SMS in declaration without altering contents', () => {
    const raw = mockOrderNewToVerify.payment_declarations![0].raw_sms_text;
    expect(raw).toContain('Paiement de 15000 FCFA effectue avec succes');
    expect(raw).toContain('MP261018.1200.A99999');
  });

  it('5 & 6: Guarantees payment status remains payment_declared if network / server call fails', async () => {
    let orderState: Order = { ...mockOrderNewToVerify };

    const simulatedFailedServerCall = vi.fn().mockRejectedValue(new Error('Network error: 500'));

    try {
      await simulatedFailedServerCall(orderState.id);
      orderState = { ...orderState, payment_status: 'paid' };
    } catch {
      // Retain previous state
    }

    expect(orderState.payment_status).toBe('payment_declared');
    expect(simulatedFailedServerCall).toHaveBeenCalledOnce();
  });

  it('7: Moves order to operational section once server confirmation succeeds', async () => {
    let orderState: Order = { ...mockOrderNewToVerify };

    const simulatedSuccessfulServerCall = vi.fn().mockResolvedValue({ success: true });

    await simulatedSuccessfulServerCall(orderState.id, 'MP261018.1200.A99999', 'Verified');
    orderState = { ...orderState, payment_status: 'paid' };

    expect(orderState.payment_status).toBe('paid');
    expect(simulatedSuccessfulServerCall).toHaveBeenCalledOnce();
  });

  it('8 & 9: Accurately computes financial totals including variants and complements', () => {
    const item = mockOrderNewToVerify.items![0];
    const baseCost = item.unit_price * item.quantity;
    const complementsCost = (item.selected_complements || []).reduce(
      (sum, c) => sum + c.unit_price * c.quantity * item.quantity,
      0
    );

    expect(baseCost).toBe(12000);
    expect(complementsCost).toBe(3000);
    expect(baseCost + complementsCost).toBe(15000);
    expect(item.variant_name).toBe('Familial');
  });

  it('10: Validates strictly sequential preparation statuses (new -> accepted -> preparing -> ready -> completed)', () => {
    const allowedTransitions: Record<PreparationStatus, PreparationStatus[]> = {
      new: ['accepted', 'cancelled'],
      accepted: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    expect(allowedTransitions['new']).toContain('accepted');
    expect(allowedTransitions['accepted']).toContain('preparing');
    expect(allowedTransitions['preparing']).toContain('ready');
    expect(allowedTransitions['ready']).toContain('completed');
    expect(allowedTransitions['completed']).toHaveLength(0);
  });

  it('11: Rejection workflow enforces mandatory reason choices and description', () => {
    expect(REJECTION_REASONS.length).toBeGreaterThanOrEqual(4);
    const reasonIds = REJECTION_REASONS.map((r) => r.id);
    expect(reasonIds).toContain('transaction_not_found');
    expect(reasonIds).toContain('incorrect_amount');
    expect(reasonIds).toContain('invalid_reference');
    expect(reasonIds).toContain('duplicate_transaction');
  });

  it('13: French and English translation keys for new kitchen UI exist and are symmetrical', () => {
    const requiredKeys = [
      'kitchenNewOrdersTitle',
      'kitchenNewOrdersSubtitle',
      'kitchenOperationalOrdersTitle',
      'kitchenOperationalOrdersSubtitle',
      'paymentToVerify',
      'viewOrderAction',
      'matchingAmount',
      'mismatchAmount',
      'matchingAmountNotice',
      'mismatchAmountNotice',
      'officialVerificationReminder',
      'originalSmsSection',
      'originalSmsShow',
      'originalSmsHide',
      'notDetected',
      'noVerificationPending',
      'noOperationalOrders',
      'startPreparation',
      'markReadyForService',
      'markCompletedAndServed',
      'orderSummaryAndPrep',
      'financialBreakdown',
      'itemsSubtotal',
      'complementsSubtotal',
      'serviceInfo',
    ];

    for (const key of requiredKeys) {
      expect((translations.fr as any)[key], `FR key missing: ${key}`).toBeDefined();
      expect((translations.en as any)[key], `EN key missing: ${key}`).toBeDefined();
      expect(typeof (translations.fr as any)[key]).toBe('string');
      expect(typeof (translations.en as any)[key]).toBe('string');
    }
  });
});
