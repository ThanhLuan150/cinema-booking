import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const validateVoucherMock = vi.fn();
vi.mock('../api/booking.api', () => ({ validateVoucher: (...args: unknown[]) => validateVoucherMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useValidateVoucher } from './useValidateVoucher';

describe('useValidateVoucher', () => {
  beforeEach(() => validateVoucherMock.mockReset());

  it('calls validateVoucher with the payload', async () => {
    validateVoucherMock.mockResolvedValue({ discount_amount: 1000 });
    const payload = { code: 'SAVE10', order_value: 100000 } as any;
    const { result } = renderHook(() => useValidateVoucher(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(validateVoucherMock).toHaveBeenCalledWith(payload);
  });
});
