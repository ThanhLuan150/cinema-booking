import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getSupportTicketsMock = vi.fn();
vi.mock('../api/customerService.api', () => ({
  getSupportTickets: (...args: unknown[]) => getSupportTicketsMock(...args),
}));

import { useSupportTickets } from './useSupportTickets';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSupportTickets', () => {
  beforeEach(() => getSupportTicketsMock.mockReset());

  it('fetches tickets for a branch with filters', async () => {
    getSupportTicketsMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useSupportTickets(1, 1, 20, { status: 'OPEN' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSupportTicketsMock).toHaveBeenCalledWith(1, { page: 1, limit: 20, status: 'OPEN' });
  });

  it('is disabled when branchId is undefined and not explicitly enabled', () => {
    const { result } = renderHook(() => useSupportTickets(undefined, 1, 20), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getSupportTicketsMock).not.toHaveBeenCalled();
  });
});
