import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyCrmProfileMock = vi.fn();
vi.mock('../api/crm.api', () => ({ getMyCrmProfile: () => getMyCrmProfileMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useMyCrmProfile } from './useMyCrmProfile';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyCrmProfile', () => {
  beforeEach(() => {
    getMyCrmProfileMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('fetches when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyCrmProfileMock.mockResolvedValue({ customer_id: 1 });
    const { result } = renderHook(() => useMyCrmProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ customer_id: 1 });
  });

  it('does not fetch when unauthenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    renderHook(() => useMyCrmProfile(), { wrapper });
    expect(getMyCrmProfileMock).not.toHaveBeenCalled();
  });
});
