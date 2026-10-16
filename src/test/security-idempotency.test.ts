import { describe, it, expect } from 'vitest';
import { generateClientAccessToken, generateIdempotencyKey } from '../lib/security';

describe('Security, Token & Idempotency Rules', () => {
  interface DbOrder {
    id: string;
    public_reference: string;
    idempotency_key: string | null;
    access_token: string;
    total_amount: number;
  }

  const simulatedDb: DbOrder[] = [];

  function simulateCreateOrder(payload: {
    idempotency_key: string;
    raw_token: string;
    amount: number;
  }) {
    // 1. Idempotency Check
    const existing = simulatedDb.find(
      (o) => o.idempotency_key === payload.idempotency_key
    );
    if (existing) {
      return {
        id: existing.id,
        public_reference: existing.public_reference,
        is_replayed: true,
      };
    }

    // 2. Insert new order
    const newOrder: DbOrder = {
      id: 'ord-' + (simulatedDb.length + 1),
      public_reference: 'CVH-26-' + (1000 + simulatedDb.length),
      idempotency_key: payload.idempotency_key,
      access_token: payload.raw_token,
      total_amount: payload.amount,
    };
    simulatedDb.push(newOrder);

    return {
      id: newOrder.id,
      public_reference: newOrder.public_reference,
      is_replayed: false,
    };
  }

  function simulateGetClientOrder(publicRef: string, rawToken: string) {
    const order = simulatedDb.find((o) => o.public_reference === publicRef);
    if (!order) {
      throw new Error('Commande non trouvée.');
    }

    // Cryptographic token match verification
    if (order.access_token !== rawToken) {
      throw new Error('Accès non autorisé à cette commande.');
    }

    return order;
  }

  it('generates high entropy random client access tokens', () => {
    const token1 = generateClientAccessToken();
    const token2 = generateClientAccessToken();

    expect(token1).toBeDefined();
    expect(token1.length).toBeGreaterThanOrEqual(32);
    expect(token1).not.toBe(token2);
  });

  it('generates unique idempotency keys', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    expect(key1).toContain('idem_');
    expect(key1).not.toBe(key2);
  });

  it('returns existing order on replayed submission without creating duplicates', () => {
    const idempotencyKey = 'unique-submit-key-123';
    const rawToken = 'client-secret-token-xyz';

    const firstResult = simulateCreateOrder({
      idempotency_key: idempotencyKey,
      raw_token: rawToken,
      amount: 15000,
    });
    expect(firstResult.is_replayed).toBe(false);

    // Repeated submission with same idempotency key (network retry or double click)
    const secondResult = simulateCreateOrder({
      idempotency_key: idempotencyKey,
      raw_token: rawToken,
      amount: 15000,
    });
    expect(secondResult.is_replayed).toBe(true);
    expect(secondResult.id).toBe(firstResult.id);
    expect(secondResult.public_reference).toBe(firstResult.public_reference);
  });

  it('permits order access with valid token and rejects unauthorized access', () => {
    const token = 'correct-token-456';
    const order = simulateCreateOrder({
      idempotency_key: 'key-abc',
      raw_token: token,
      amount: 8000,
    });

    // Valid lookup
    const retrieved = simulateGetClientOrder(order.public_reference, token);
    expect(retrieved.id).toBe(order.id);

    // Unauthorized lookup attempt with invalid or stolen reference
    expect(() =>
      simulateGetClientOrder(order.public_reference, 'wrong-token-999')
    ).toThrow(/Accès non autorisé/);
  });
});
