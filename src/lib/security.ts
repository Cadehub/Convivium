/**
 * Cryptographic & Token Utilities for Convivium Home Hotel
 * - Generates high-entropy client order access tokens
 * - Generates unique idempotency keys
 * - Securely stores and retrieves order tokens in client localStorage
 */

export function generateClientAccessToken(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(32); // 256 bits of entropy
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for non-browser/test environments
  return (
    'token_' +
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
}

export function generateIdempotencyKey(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return 'idem_' + window.crypto.randomUUID();
  }
  return 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

const STORAGE_KEY_ORDER_TOKENS = 'convivium_order_tokens_v1';
const STORAGE_KEY_CLIENT_ORDERS = 'convivium_client_orders_v1';
const STORAGE_KEY_CUSTOMER_INFO = 'convivium_customer_info_v1';
const STORAGE_KEY_PENDING_PAYMENT = 'convivium_pending_payment_v1';
const STORAGE_KEY_TRACKING_REF = 'convivium_tracking_ref_v1';

export interface StoredClientOrderSummary {
  public_reference: string;
  raw_token: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
  order_mode?: string;
  location_detail?: string;
  payment_status?: string;
  preparation_status?: string;
}

export interface StoredCustomerInfo {
  customerName: string;
  customerPhone?: string;
  orderMode?: string;
  locationDetail?: string;
}

export function storeClientOrderToken(publicRef: string, rawToken: string): void {
  try {
    const existing = getStoredClientOrderTokens();
    existing[publicRef] = rawToken;
    localStorage.setItem(STORAGE_KEY_ORDER_TOKENS, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to store order token in localStorage', e);
  }
}

export function getStoredClientOrderToken(publicRef: string): string | null {
  try {
    const tokens = getStoredClientOrderTokens();
    return tokens[publicRef] || null;
  } catch {
    return null;
  }
}

export function getStoredClientOrderTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDER_TOKENS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Full client orders history on this device
export function saveStoredClientOrder(order: StoredClientOrderSummary): void {
  try {
    const list = getStoredClientOrders();
    const filtered = list.filter((o) => o.public_reference !== order.public_reference);
    filtered.unshift(order);
    localStorage.setItem(STORAGE_KEY_CLIENT_ORDERS, JSON.stringify(filtered.slice(0, 20)));
    // Also save individual token
    storeClientOrderToken(order.public_reference, order.raw_token);
  } catch (e) {
    console.error('Failed to save client order in localStorage', e);
  }
}

export function getStoredClientOrders(): StoredClientOrderSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLIENT_ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestStoredClientOrder(): StoredClientOrderSummary | null {
  const orders = getStoredClientOrders();
  return orders.length > 0 ? orders[0] : null;
}

/**
 * Clears the customer's order tracking history on THIS device: the saved orders list,
 * the stored access tokens and the active tracking reference. Orders themselves are
 * untouched on the server. A payment still pending finalisation and the remembered
 * checkout details are intentionally kept (they have their own lifecycle).
 */
export function clearClientOrderHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ORDERS);
    localStorage.removeItem(STORAGE_KEY_ORDER_TOKENS);
    localStorage.removeItem(STORAGE_KEY_TRACKING_REF);
  } catch (e) {
    console.error('Failed to clear client order history', e);
  }
}

// Customer details remembered for checkout
export function saveCustomerInfo(info: StoredCustomerInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMER_INFO, JSON.stringify(info));
  } catch (e) {
    console.error('Failed to save customer info', e);
  }
}

export function getSavedCustomerInfo(): StoredCustomerInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_INFO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Active pending payment modal order persistence
export function savePendingPaymentOrder(order: unknown): void {
  try {
    if (!order) {
      localStorage.removeItem(STORAGE_KEY_PENDING_PAYMENT);
    } else {
      localStorage.setItem(STORAGE_KEY_PENDING_PAYMENT, JSON.stringify(order));
    }
  } catch (e) {
    console.error('Failed to save pending payment order', e);
  }
}

export function getPendingPaymentOrder<T>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_PAYMENT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingPaymentOrder(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_PAYMENT);
  } catch (e) {
    console.error('Failed to clear pending payment order', e);
  }
}

// Active tracking reference persistence
export function saveActiveTrackingRef(ref: string | null): void {
  try {
    if (!ref) {
      localStorage.removeItem(STORAGE_KEY_TRACKING_REF);
    } else {
      localStorage.setItem(STORAGE_KEY_TRACKING_REF, ref);
    }
  } catch (e) {
    console.error('Failed to save tracking ref', e);
  }
}

export function getActiveTrackingRef(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_TRACKING_REF);
  } catch {
    return null;
  }
}

export function updateStoredClientOrderStatus(
  publicReference: string,
  updates: {
    payment_status?: string;
    preparation_status?: string;
  }
): void {
  try {
    const list = getStoredClientOrders();
    const updated = list.map((o) => {
      if (o.public_reference === publicReference) {
        return {
          ...o,
          payment_status: updates.payment_status || o.payment_status,
          preparation_status: updates.preparation_status || o.preparation_status,
        };
      }
      return o;
    });
    localStorage.setItem(STORAGE_KEY_CLIENT_ORDERS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update client order in localStorage', e);
  }
}

