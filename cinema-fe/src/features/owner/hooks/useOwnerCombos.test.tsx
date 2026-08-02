import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerCombosMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerCombos: (...args: unknown[]) => getOwnerCombosMock(...args) }));

import { useOwnerCombos } from './useOwnerCombos';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerCombos', () => {
  beforeEach(() => getOwnerCombosMock.mockReset());

  it('fetches the owner\'s combos for the given page/limit', async () => {
    getOwnerCombosMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerCombos(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerCombosMock).toHaveBeenCalledWith(undefined, { page: 1, limit: 20 });
  });
});
