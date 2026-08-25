import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getTicketByIdMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getTicketById: (...args: unknown[]) => getTicketByIdMock(...args) }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useTicket } from './useTicket';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useTicket', () => {
  beforeEach(() => {
    getTicketByIdMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useTicket(5), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when no id is given', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    const { result } = renderHook(() => useTicket(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the ticket by id when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getTicketByIdMock.mockResolvedValue({ ticket_id: 5 });
    const { result } = renderHook(() => useTicket(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTicketByIdMock).toHaveBeenCalledWith(5);
  });
});
