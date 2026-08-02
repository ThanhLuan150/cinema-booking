import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerVouchersMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerVouchers: (...args: unknown[]) => getOwnerVouchersMock(...args) }));

import { useOwnerVouchers } from './useOwnerVouchers';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerVouchers', () => {
  beforeEach(() => getOwnerVouchersMock.mockReset());

  it('fetches the owner\'s vouchers for the given page/limit', async () => {
    getOwnerVouchersMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerVouchers(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerVouchersMock).toHaveBeenCalledWith(undefined, { page: 1, limit: 20 });
  });
});
