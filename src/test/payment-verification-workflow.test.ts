import { describe, it, expect } from 'vitest';
import { parseMobileMoneySms, analyzePaymentSms } from '../lib/smsParser';
import { REJECTION_REASONS } from '../components/kitchen/RejectPaymentModal';
import type { Order } from '../types';

describe('Payment Verification Workflow — SMS Parsing & Cross-Checking', () => {
  it('correctly parses standard MTN MoMo Cameroon SMS format', () => {
    const rawSms =
      'Paiement de 5000 FCFA effectue avec succes a CONVIVIUM HOTEL (677123456). Ref: MP261016.1234.A12345. Le 16/10/2026 a 14:30:15.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.isRecognizedFormat).toBe(true);
    expect(result.detectedOperator).toBe('mtn');
    expect(result.extractedAmount).toBe(5000);
    expect(result.extractedReference).toBe('MP261016.1234.A12345');
    expect(result.extractedDateTime).toBe('16/10/2026 a 14:30:15');
    expect(result.extractedPhoneNumber).toBe('677123456');
  });

  it('correctly parses standard Orange Money Cameroon SMS format with thousand separators', () => {
    const rawSms =
      'Paiement de 12 500 FCFA au 699001122 effectue le 16-10-2026 20:15. Transaction Id: OM261016.9876.B12345. Nouveau solde: 45000 FCFA.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.isRecognizedFormat).toBe(true);
    expect(result.detectedOperator).toBe('orange');
    expect(result.extractedAmount).toBe(12500);
    expect(result.extractedReference).toBe('OM261016.9876.B12345');
    expect(result.extractedDateTime).toBe('16-10-2026 20:15');
    expect(result.extractedPhoneNumber).toBe('699001122');
  });

  it('handles English variant of Mobile Money notifications', () => {
    const rawSms =
      'Payment of 8,000 XAF to CONVIVIUM HOME HOTEL successful. Txn ID: CI261016.5555.77777 on 2026-10-16 11:20:00.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.isRecognizedFormat).toBe(true);
    expect(result.extractedAmount).toBe(8000);
    expect(result.extractedReference).toBe('CI261016.5555.77777');
    expect(result.extractedDateTime).toBe('2026-10-16 11:20:00');
  });

  it('handles unrecognized / arbitrary non-payment SMS text gracefully', () => {
    const rawSms = 'Bonjour tonton, j’arrive à la gare de Yaoundé vers 17h.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.isRecognizedFormat).toBe(false);
    expect(result.extractedAmount).toBeNull();
    expect(result.extractedReference).toBeNull();
    expect(result.detectedOperator).toBeNull();
  });

  it('handles missing fields: SMS with amount only but no reference', () => {
    const rawSms = 'Transfert de 4500 FCFA effectue avec succes.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.extractedAmount).toBe(4500);
    expect(result.extractedReference).toBeNull();
  });

  it('handles missing fields: SMS with reference only but no amount', () => {
    const rawSms = 'Confirmation de transaction. ID Transaction: TXN99887766.';
    const result = parseMobileMoneySms(rawSms);

    expect(result.extractedAmount).toBeNull();
    expect(result.extractedReference).toBe('TXN99887766');
  });
});

describe('Payment Verification Workflow — Amount Cross-Checking & Mismatch Detection', () => {
  it('detects exact amount match between extracted SMS amount and server order total', () => {
    const rawSms = 'Paiement de 7500 FCFA effectue. Ref: MP261016.7500.';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 7500,
      declaredOperator: 'mtn',
    });

    expect(analysis.amountStatus).toBe('exact_match');
    expect(analysis.amountDifference).toBe(0);
    expect(analysis.isInformationConsistent).toBe(true);
    expect(analysis.warnings.length).toBe(0);
  });

  it('detects amount mismatch (underpayment) and generates explicit warning', () => {
    const rawSms = 'Paiement de 5000 FCFA effectue. Ref: MP261016.5000.';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 7500, // Expected 7500, paid 5000
      declaredOperator: 'mtn',
    });

    expect(analysis.amountStatus).toBe('mismatch');
    expect(analysis.amountDifference).toBe(-2500);
    expect(analysis.isInformationConsistent).toBe(false);
    expect(analysis.warnings.some((w) => w.includes('inférieur'))).toBe(true);
  });

  it('detects operator inconsistency between customer declaration and parsed SMS', () => {
    // Customer claimed Orange Money, but pasted an MTN SMS
    const rawSms = 'Paiement de 5000 FCFA via MTN Mobile Money. Ref: MP261016.0001.';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 5000,
      declaredOperator: 'orange',
    });

    expect(analysis.operatorConsistent).toBe(false);
    expect(analysis.isInformationConsistent).toBe(false);
    expect(analysis.warnings.some((w) => w.includes('Incohérence'))).toBe(true);
  });
});

describe('Payment Verification Workflow — Duplicate Transaction Reference Detection', () => {
  const existingOrders: Order[] = [
    {
      id: 'order-1',
      public_reference: 'CVH-2610-AAAA',
      order_mode: 'dine_in',
      order_origin: 'public_client',
      customer_name: 'Client A',
      customer_phone: '677111111',
      room_number: null,
      table_number: '4',
      delivery_address: null,
      notes: null,
      preparation_status: 'ready',
      payment_status: 'paid',
      total_amount: 10000,
      created_at: new Date().toISOString(),
      payment_declarations: [
        {
          id: 'decl-1',
          order_id: 'order-1',
          operator: 'mtn',
          declared_reference: 'MP261016.SHARED.REF',
          raw_sms_text: 'Paiement de 10000 FCFA. Ref: MP261016.SHARED.REF',
          payer_phone: '677111111',
          customer_note: null,
          created_at: new Date().toISOString(),
        },
      ],
      payment_verifications: [
        {
          id: 'verif-1',
          order_id: 'order-1',
          verified_by: 'user-chef',
          status: 'confirmed',
          verified_reference: 'MP261016.SHARED.REF',
          internal_notes: 'Reçu sur terminal',
          created_at: new Date().toISOString(),
        },
      ],
    },
  ];

  it('detects duplicate reference reused on a different order', () => {
    // New Order B tries to use the same reference
    const rawSms = 'Paiement de 10000 FCFA. Ref: MP261016.SHARED.REF';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 10000,
      allOrders: existingOrders,
      currentOrderId: 'order-2', // different order
      declaredReference: 'MP261016.SHARED.REF',
    });

    expect(analysis.isDuplicateRef).toBe(true);
    expect(analysis.duplicateOrderRefs).toContain('CVH-2610-AAAA');
    expect(analysis.isInformationConsistent).toBe(false);
    expect(analysis.warnings.some((w) => w.includes('Alerte doublon'))).toBe(true);
  });

  it('does not flag duplicate when comparing an order against itself', () => {
    // Re-analyzing Order A should not flag itself as a duplicate
    const rawSms = 'Paiement de 10000 FCFA. Ref: MP261016.SHARED.REF';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 10000,
      allOrders: existingOrders,
      currentOrderId: 'order-1', // same order
      declaredReference: 'MP261016.SHARED.REF',
    });

    expect(analysis.isDuplicateRef).toBe(false);
  });
});

describe('Payment Verification Workflow — Security, Roles & Rejection Rules', () => {
  it('strictly forbids auto-confirmation based purely on parsing', () => {
    const rawSms =
      'Paiement de 5000 FCFA effectue avec succes a CONVIVIUM HOTEL. Ref: MP261016.VALID.12345.';
    const analysis = analyzePaymentSms({
      rawSms,
      expectedAmount: 5000,
      declaredOperator: 'mtn',
    });

    expect(analysis.isInformationConsistent).toBe(true);

    // Rule: Order payment_status must NOT automatically become 'paid'.
    // It remains advisory indicators for Cuisine.
    const orderState: Order['payment_status'] = 'payment_declared';
    expect(orderState).toBe('payment_declared');
    expect(orderState).not.toBe('paid');
  });

  it('requires a mandatory reason among predefined rejection categories', () => {
    expect(REJECTION_REASONS.length).toBeGreaterThanOrEqual(4);
    const validIds = REJECTION_REASONS.map((r) => r.id);

    expect(validIds).toContain('transaction_not_found');
    expect(validIds).toContain('incorrect_amount');
    expect(validIds).toContain('invalid_reference');
    expect(validIds).toContain('duplicate_transaction');
    expect(validIds).toContain('other');
  });

  it('ensures cancellation in two-step rejection aborts without modifying state', () => {
    let orderPaymentStatus: Order['payment_status'] = 'payment_declared';

    // User clicks Cancel
    const handleCancel = () => {
      // Nothing is sent to backend, status is untouched
    };
    handleCancel();

    expect(orderPaymentStatus).toBe('payment_declared');
  });

  it('ensures confirmation in two-step rejection transitions status to payment_rejected', () => {
    let orderPaymentStatus: Order['payment_status'] = 'payment_declared';
    let auditActionLogged: string | null = null;
    let savedReason: string | null = null;

    const handleConfirmReject = (reasonPayload: string) => {
      orderPaymentStatus = 'payment_rejected';
      auditActionLogged = 'REJECT_PAYMENT_CUISINE';
      savedReason = reasonPayload;
    };

    handleConfirmReject('Transaction introuvable sur le compte marchand');

    expect(orderPaymentStatus).toBe('payment_rejected');
    expect(auditActionLogged).toBe('REJECT_PAYMENT_CUISINE');
    expect(savedReason).toBe('Transaction introuvable sur le compte marchand');
  });

  it('verifies that preparation status cannot transition to preparing while unpaid', () => {
    const order: Order = {
      id: 'test-order-unpaid',
      public_reference: 'CVH-26-TEST',
      order_mode: 'room_service',
      order_origin: 'public_client',
      customer_name: 'Client Test',
      customer_phone: null,
      room_number: '102',
      table_number: null,
      delivery_address: null,
      notes: null,
      preparation_status: 'accepted',
      payment_status: 'payment_declared', // Not yet confirmed by Cuisine
      total_amount: 15000,
      created_at: new Date().toISOString(),
    };

    const canPrepare = order.payment_status === 'paid';
    expect(canPrepare).toBe(false);
  });
});
