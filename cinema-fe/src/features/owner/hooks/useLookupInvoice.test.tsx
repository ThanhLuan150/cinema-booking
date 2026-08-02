import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const lookupInvoiceByCodeMock = vi.fn();
vi.mock('../api/owner.api', () => ({ lookupInvoiceByCode: (...args: unknown[]) => lookupInvoiceByCodeMock(...args) }));

import { useLookupInvoice } from './useLookupInvoice';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useLookupInvoice', () => {
  beforeEach(() => lookupInvoiceByCodeMock.mockReset());

  it('looks up an invoice by code', async () => {
    lookupInvoiceByCodeMock.mockResolvedValue({ code: 'ABC123' });
    const { result } = renderHook(() => useLookupInvoice(), { wrapper });
    result.current.mutate('ABC123');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lookupInvoiceByCodeMock).toHaveBeenCalledWith('ABC123');
  });
});
