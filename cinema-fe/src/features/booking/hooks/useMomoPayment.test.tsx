import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const momoPaymentMock = vi.fn();
vi.mock('../api/booking.api', () => ({ momoPayment: (...args: unknown[]) => momoPaymentMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useMomoPayment } from './useMomoPayment';

describe('useMomoPayment', () => {
  beforeEach(() => momoPaymentMock.mockReset());

  it('calls momoPayment with the order payload and idempotency key', async () => {
    momoPaymentMock.mockResolvedValue('https://momo.pay/redirect');
    const payload = { ticketIds: [1], totalPrice: 1000 } as any;
    const { result } = renderHook(() => useMomoPayment(), { wrapper });
    result.current.mutate({ payload, idempotencyKey: 'key-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(momoPaymentMock).toHaveBeenCalledWith(payload, 'key-1');
  });
});
