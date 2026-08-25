import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const lookupInvoiceByCodeMock = vi.fn();
const checkInInvoiceMock = vi.fn();
const verifyTicketByQrMock = vi.fn();
vi.mock('../api/employee.api', () => ({
  lookupInvoiceByCode: (...args: unknown[]) => lookupInvoiceByCodeMock(...args),
  checkInInvoice: (...args: unknown[]) => checkInInvoiceMock(...args),
  verifyTicketByQr: (...args: unknown[]) => verifyTicketByQrMock(...args),
}));

import { useCheckInInvoice, useLookupInvoiceForCheckIn, useVerifyTicketByQr } from './useInvoiceCheckIn';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useLookupInvoiceForCheckIn', () => {
  beforeEach(() => lookupInvoiceByCodeMock.mockReset());

  it('does not fetch automatically (manual refetch only)', () => {
    const { result } = renderHook(() => useLookupInvoiceForCheckIn('ABC'), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(lookupInvoiceByCodeMock).not.toHaveBeenCalled();
  });

  it('fetches when refetch is called', async () => {
    lookupInvoiceByCodeMock.mockResolvedValue({ id: 1, code: 'ABC' });
    const { result } = renderHook(() => useLookupInvoiceForCheckIn('ABC'), { wrapper });
    await result.current.refetch();
    await waitFor(() => expect(lookupInvoiceByCodeMock).toHaveBeenCalledWith('ABC'));
  });
});

describe('useCheckInInvoice', () => {
  beforeEach(() => checkInInvoiceMock.mockReset());

  it('calls the check-in endpoint', async () => {
    checkInInvoiceMock.mockResolvedValue({});
    const { result } = renderHook(() => useCheckInInvoice(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(checkInInvoiceMock).toHaveBeenCalledWith(1);
  });
});

describe('useVerifyTicketByQr', () => {
  beforeEach(() => verifyTicketByQrMock.mockReset());

  it('calls the QR verify endpoint with the scanned token', async () => {
    verifyTicketByQrMock.mockResolvedValue({ ticket_id: 1, status: 'ISSUED' });
    const { result } = renderHook(() => useVerifyTicketByQr(), { wrapper });
    result.current.mutate('TCK-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(verifyTicketByQrMock).toHaveBeenCalledWith('TCK-1');
  });
});
