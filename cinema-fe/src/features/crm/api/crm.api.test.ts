import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('services/apiClient', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

import { getMyCrmProfile, getCustomerCrmProfile } from './crm.api';

describe('crm.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getMyCrmProfile gets /crm/me', async () => {
    await getMyCrmProfile();
    expect(getMock).toHaveBeenCalledWith('/crm/me');
  });

  it('getCustomerCrmProfile gets /crm/customers/:id', async () => {
    await getCustomerCrmProfile(42);
    expect(getMock).toHaveBeenCalledWith('/crm/customers/42');
  });
});
