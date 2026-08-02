import { describe, expect, it } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  it('is configured with the env base URL', () => {
    expect(apiClient.defaults.baseURL).toBe(import.meta.env.VITE_API_BASE_URL);
  });
});
