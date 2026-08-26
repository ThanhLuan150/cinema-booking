import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerInventoryMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerInventory: (...args: unknown[]) => getOwnerInventoryMock(...args) }));

import { useOwnerInventory } from './useOwnerInventory';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerInventory', () => {
  beforeEach(() => getOwnerInventoryMock.mockReset());

  it('fetches the owner\'s inventory for the given page/limit/status', async () => {
    getOwnerInventoryMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerInventory(1, 20, 'LOW_STOCK'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerInventoryMock).toHaveBeenCalledWith(undefined, { page: 1, limit: 20, status: 'LOW_STOCK' });
  });
});
