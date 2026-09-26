import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getInventoryHistoryMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getInventoryHistory: (...args: unknown[]) => getInventoryHistoryMock(...args) }));

import { useInventoryHistory } from './useInventoryHistory';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useInventoryHistory', () => {
  beforeEach(() => getInventoryHistoryMock.mockReset());

  it('fetches one item\'s movements, optionally filtered by type', async () => {
    getInventoryHistoryMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useInventoryHistory(4, 1, 20, 'WASTE'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getInventoryHistoryMock).toHaveBeenCalledWith(4, { page: 1, limit: 20, type: 'WASTE' });
  });

  it('does not fetch until an item is chosen', () => {
    renderHook(() => useInventoryHistory(null, 1, 20), { wrapper });
    expect(getInventoryHistoryMock).not.toHaveBeenCalled();
  });
});
