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
