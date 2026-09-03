import { describe, expect, it, beforeEach } from 'vitest';
import { kioskClient, getStoredKioskKey, setStoredKioskKey, KIOSK_KEY_STORAGE } from './kioskClient';

// Reaches into the axios instance's registered request interceptor and runs it against a bare
// config object — the cheapest way to assert "the key gets attached as X-Kiosk-Key".
function runRequestInterceptor(config: { headers: Record<string, unknown> }): { headers: Record<string, unknown> } {
  const handler = (kioskClient.interceptors.request as unknown as { handlers: { fulfilled: (c: unknown) => unknown }[] })
    .handlers[0];
  return handler.fulfilled(config) as { headers: Record<string, unknown> };
}

describe('kioskClient', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and clears the kiosk key', () => {
    setStoredKioskKey('KIOSK-abc');
    expect(getStoredKioskKey()).toBe('KIOSK-abc');
    expect(localStorage.getItem(KIOSK_KEY_STORAGE)).toBe('KIOSK-abc');
    setStoredKioskKey(null);
    expect(getStoredKioskKey()).toBeNull();
  });

  it('injects the X-Kiosk-Key header when a key is stored', () => {
    setStoredKioskKey('KIOSK-xyz');
    const out = runRequestInterceptor({ headers: {} });
    expect(out.headers['X-Kiosk-Key']).toBe('KIOSK-xyz');
  });

  it('adds no header when no key is stored', () => {
    const out = runRequestInterceptor({ headers: {} });
    expect(out.headers['X-Kiosk-Key']).toBeUndefined();
  });
});
