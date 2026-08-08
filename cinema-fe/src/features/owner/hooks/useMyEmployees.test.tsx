import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyEmployeesMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getMyEmployees: (...args: unknown[]) => getMyEmployeesMock(...args) }));

import { useMyEmployees } from './useMyEmployees';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyEmployees', () => {
  beforeEach(() => getMyEmployeesMock.mockReset());

  it('fetches employees for the given cinema/page/limit', async () => {
    getMyEmployeesMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useMyEmployees(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyEmployeesMock).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });

  it('stays disabled when no cinema is selected', () => {
    const { result } = renderHook(() => useMyEmployees(undefined, 1, 20), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMyEmployeesMock).not.toHaveBeenCalled();
  });
});
