import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCombosMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getCombos: (...args: unknown[]) => getCombosMock(...args) }));

import { useCombos } from './useCombos';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCombos', () => {
  beforeEach(() => getCombosMock.mockReset());

  it('fetches combos for the given cinema', async () => {
    getCombosMock.mockResolvedValue([{ id: 1, name: 'Popcorn' }]);
    const { result } = renderHook(() => useCombos(3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCombosMock).toHaveBeenCalledWith(3);
  });
});
