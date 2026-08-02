import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const confirmMomoPaymentMock = vi.fn();
vi.mock('../api/booking.api', () => ({
  confirmMomoPayment: (...args: unknown[]) => confirmMomoPaymentMock(...args),
}));

import { useConfirmMomoPayment } from './useConfirmMomoPayment';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useConfirmMomoPayment', () => {
  beforeEach(() => confirmMomoPaymentMock.mockReset());

  it('calls confirmMomoPayment with the redirect params', async () => {
    confirmMomoPaymentMock.mockResolvedValue({ message: 'success' });
    const payload = { orderId: 'X', resultCode: '0' } as any;
    const { result } = renderHook(() => useConfirmMomoPayment(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(confirmMomoPaymentMock).toHaveBeenCalledWith(payload);
  });
});
