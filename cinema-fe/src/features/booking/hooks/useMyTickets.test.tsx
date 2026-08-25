import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyTicketsMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getMyTickets: () => getMyTicketsMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useMyTickets } from './useMyTickets';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyTickets', () => {
  beforeEach(() => {
    getMyTicketsMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useMyTickets(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches tickets when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyTicketsMock.mockResolvedValue([{ ticket_id: 1 }]);
    const { result } = renderHook(() => useMyTickets(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyTicketsMock).toHaveBeenCalled();
  });
});
