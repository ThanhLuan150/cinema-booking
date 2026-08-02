import { describe, expect, it, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '@/constants/storage';
import apiClient from './apiClient';

describe('apiClient request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches an Authorization header when a token is stored', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'abc123');
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
  });

  it('leaves the Authorization header unset when there is no token', async () => {
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});
