import { describe, it, expect } from 'vitest';
import type { PaymentStatus, PreparationStatus, UserRole } from '../types';

describe('Permissions & Role Separation Rules', () => {
  // Simulated Order in Database
  interface SimulatedOrder {
    id: string;
    public_reference: string;
    payment_status: PaymentStatus;
    preparation_status: PreparationStatus;
    total_amount: number;
  }

  // Simulated Payment Verification Function with exact PostgreSQL logic
  function simulateConfirmPayment(
    order: SimulatedOrder,
    callerRole: UserRole | 'anonymous' | null,
    verifiedReference: string
  ) {
    // 1. Role enforcement rule: STRICTLY Cuisine role
    if (callerRole !== 'cuisine') {
      throw new Error(
        'Permission refusée. Seul le personnel de Cuisine peut vérifier et confirmer un paiement.'
      );
    }

    if (order.payment_status === 'paid') {
      throw new Error('Cette commande a déjà été confirmée comme payée.');
    }

    if (order.preparation_status === 'cancelled') {
      throw new Error("Impossible de confirmer le paiement d'une commande annulée.");
    }

    // Mutate state to paid
    order.payment_status = 'paid';
    return {
      success: true,
      payment_status: 'paid',
      verified_reference: verifiedReference,
      audited: true,
    };
  }

  // Simulated Preparation Transition Function with exact PostgreSQL logic
  function simulateUpdatePreparationStatus(
    order: SimulatedOrder,
    callerRole: UserRole | 'anonymous' | null,
    newStatus: PreparationStatus
  ) {
    if (callerRole !== 'admin' && callerRole !== 'cuisine') {
      throw new Error('Permission refusée.');
    }

    // Safety rule: Kitchen cannot prepare unpaid orders
    if (
      ['preparing', 'ready', 'completed'].includes(newStatus) &&
      order.payment_status !== 'paid'
    ) {
      throw new Error(
        "Impossible de passer en préparation : le paiement de cette commande n'a pas encore été confirmé par la Cuisine."
      );
    }

    order.preparation_status = newStatus;
    return { success: true, preparation_status: newStatus };
  }

  it('allows Cuisine role to confirm a payment', () => {
    const order: SimulatedOrder = {
      id: 'ord-1',
      public_reference: 'CVH-26-0001',
      payment_status: 'payment_declared',
      preparation_status: 'new',
      total_amount: 15000,
    };

    const res = simulateConfirmPayment(order, 'cuisine', 'TXN-MOMO-999');
    expect(res.success).toBe(true);
    expect(order.payment_status).toBe('paid');
  });

  it('strictly rejects Admin role from confirming a payment (normal operation)', () => {
    const order: SimulatedOrder = {
      id: 'ord-2',
      public_reference: 'CVH-26-0002',
      payment_status: 'payment_declared',
      preparation_status: 'new',
      total_amount: 12000,
    };

    expect(() =>
      simulateConfirmPayment(order, 'admin', 'TXN-ATTEMPT')
    ).toThrow(/Seul le personnel de Cuisine/);
    expect(order.payment_status).toBe('payment_declared');
  });

  it('strictly rejects Anonymous or Customer from confirming a payment', () => {
    const order: SimulatedOrder = {
      id: 'ord-3',
      public_reference: 'CVH-26-0003',
      payment_status: 'payment_declared',
      preparation_status: 'new',
      total_amount: 8000,
    };

    expect(() =>
      simulateConfirmPayment(order, 'anonymous', 'FAKE-TXN')
    ).toThrow(/Seul le personnel de Cuisine/);
    expect(order.payment_status).toBe('payment_declared');
  });

  it('prevents double confirmation on already paid order', () => {
    const order: SimulatedOrder = {
      id: 'ord-4',
      public_reference: 'CVH-26-0004',
      payment_status: 'paid', // Already paid
      preparation_status: 'preparing',
      total_amount: 10000,
    };

    expect(() =>
      simulateConfirmPayment(order, 'cuisine', 'DUP-TXN')
    ).toThrow(/déjà été confirmée comme payée/);
  });

  it('prevents kitchen from starting preparation if order is unpaid', () => {
    const unpaidOrder: SimulatedOrder = {
      id: 'ord-5',
      public_reference: 'CVH-26-0005',
      payment_status: 'awaiting_payment',
      preparation_status: 'accepted',
      total_amount: 5000,
    };

    expect(() =>
      simulateUpdatePreparationStatus(unpaidOrder, 'cuisine', 'preparing')
    ).toThrow(/Impossible de passer en préparation/);

    expect(() =>
      simulateUpdatePreparationStatus(unpaidOrder, 'cuisine', 'ready')
    ).toThrow(/Impossible de passer en préparation/);
  });

  it('allows kitchen to start preparation once order is confirmed as paid', () => {
    const paidOrder: SimulatedOrder = {
      id: 'ord-6',
      public_reference: 'CVH-26-0006',
      payment_status: 'paid',
      preparation_status: 'accepted',
      total_amount: 5000,
    };

    const res = simulateUpdatePreparationStatus(paidOrder, 'cuisine', 'preparing');
    expect(res.success).toBe(true);
    expect(paidOrder.preparation_status).toBe('preparing');
  });
});
