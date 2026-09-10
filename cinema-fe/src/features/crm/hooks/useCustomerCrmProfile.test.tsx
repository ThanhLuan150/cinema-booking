import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCustomerCrmProfileMock = vi.fn();
vi.mock('../api/crm.api', () => ({
  getCustomerCrmProfile: (...args: unknown[]) => getCustomerCrmProfileMock(...args),
}));

import { useCustomerCrmProfile } from './useCustomerCrmProfile';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCustomerCrmProfile', () => {
  beforeEach(() => getCustomerCrmProfileMock.mockReset());

  it('fetches when an accountId is given', async () => {
    getCustomerCrmProfileMock.mockResolvedValue({ customer_id: 5 });
    const { result } = renderHook(() => useCustomerCrmProfile(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ customer_id: 5 });
    expect(getCustomerCrmProfileMock).toHaveBeenCalledWith(5);
  });

  it('is disabled when accountId is null', () => {
    renderHook(() => useCustomerCrmProfile(null), { wrapper });
    expect(getCustomerCrmProfileMock).not.toHaveBeenCalled();
  });
});
