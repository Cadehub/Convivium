import { describe, it, expect } from 'vitest';
import type { Order } from '../types';

describe('Dashboard Separation of Served Orders & User Guides', () => {
  // Synthetic order fixtures
  const mockOrders: Order[] = [
    {
      id: 'ord-1',
      public_reference: 'CVH-2610-0001',
      order_origin: 'public_client',
      order_mode: 'dine_in',
      customer_name: 'Client A',
      customer_phone: '699000001',
      room_number: null,
      table_number: 'Table 1',
      delivery_address: null,
      notes: null,
      preparation_status: 'preparing', // Active in kitchen
      payment_status: 'paid',
      delivery_fee: 0,
      total_amount: 5000,
      payment_verifications: [
        {
          id: 'pv-1',
          order_id: 'ord-1',
          verified_by: 'staff-1',
          status: 'confirmed',
          verified_reference: 'MTN123',
          internal_notes: null,
          created_at: '2026-10-19T10:00:00Z',
        },
      ],
      created_at: '2026-10-19T09:50:00Z',
      items: [],
    },
    {
      id: 'ord-2',
      public_reference: 'CVH-2610-0002',
      order_origin: 'public_client',
      order_mode: 'room_service',
      customer_name: 'Client B',
      customer_phone: '699000002',
      room_number: 'Chambre 102',
      table_number: null,
      delivery_address: null,
      notes: null,
      preparation_status: 'ready', // Ready for pickup
      payment_status: 'paid',
      delivery_fee: 0,
      total_amount: 7500,
      payment_verifications: [
        {
          id: 'pv-2',
          order_id: 'ord-2',
          verified_by: 'staff-1',
          status: 'confirmed',
          verified_reference: 'OM456',
          internal_notes: null,
          created_at: '2026-10-19T10:05:00Z',
        },
      ],
      created_at: '2026-10-19T09:55:00Z',
      items: [],
    },
    {
      id: 'ord-3',
      public_reference: 'CVH-2610-0003',
      order_origin: 'public_client',
      order_mode: 'dine_in',
      customer_name: 'Client C',
      customer_phone: null,
      room_number: null,
      table_number: 'Table 4',
      delivery_address: null,
      notes: null,
      preparation_status: 'completed', // Already served!
      payment_status: 'paid',
      delivery_fee: 0,
      total_amount: 12000,
      payment_verifications: [
        {
          id: 'pv-3',
          order_id: 'ord-3',
          verified_by: 'staff-1',
          status: 'confirmed',
          verified_reference: 'MTN789',
          internal_notes: null,
          created_at: '2026-10-19T09:30:00Z',
        },
      ],
      created_at: '2026-10-19T09:15:00Z',
      items: [],
    },
    {
      id: 'ord-4',
      public_reference: 'CVH-2610-0004',
      order_origin: 'public_client',
      order_mode: 'delivery',
      customer_name: 'Client D',
      customer_phone: '699000004',
      room_number: null,
      table_number: null,
      delivery_address: 'Bonapriso',
      notes: null,
      preparation_status: 'cancelled', // Cancelled
      payment_status: 'awaiting_payment',
      delivery_fee: 1000,
      total_amount: 6000,
      payment_verifications: [],
      created_at: '2026-10-19T08:00:00Z',
      items: [],
    },
  ];

  it('strictly excludes completed orders from active kitchen orders', () => {
    // Pure logic replica of KitchenWorkspace activePaidOrders filter
    const activePaidOrders = mockOrders.filter(
      (o) =>
        o.payment_status === 'paid' &&
        o.preparation_status !== 'completed' &&
        o.preparation_status !== 'cancelled'
    );

    expect(activePaidOrders).toHaveLength(2);
    expect(activePaidOrders.map((o) => o.id)).toEqual(['ord-1', 'ord-2']);
    // ord-3 (completed) must NEVER appear
    expect(activePaidOrders.some((o) => o.id === 'ord-3')).toBe(false);
  });

  it('isolates completed and cancelled orders into order history', () => {
    // Pure logic replica of KitchenHistoryView filter
    const historyOrders = mockOrders.filter(
      (o) => o.preparation_status === 'completed' || o.preparation_status === 'cancelled'
    );

    expect(historyOrders).toHaveLength(2);
    expect(historyOrders.map((o) => o.id)).toEqual(['ord-3', 'ord-4']);
    expect(historyOrders.some((o) => o.preparation_status === 'completed')).toBe(true);
  });

  it('calculates served revenue only from completed and paid orders in history', () => {
    const historyOrders = mockOrders.filter(
      (o) => o.preparation_status === 'completed' || o.preparation_status === 'cancelled'
    );

    const totalServedRevenue = historyOrders
      .filter((o) => o.preparation_status === 'completed' && o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total_amount, 0);

    expect(totalServedRevenue).toBe(12000);
  });
});
