import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createCinemaMock = vi.fn();
vi.mock('../api/owner.api', () => ({ createCinema: (...args: unknown[]) => createCinemaMock(...args) }));

import { useCreateCinema } from './useCreateCinema';

describe('useCreateCinema', () => {
  beforeEach(() => createCinemaMock.mockReset());

  it('creates the cinema and invalidates myCinemas', async () => {
    createCinemaMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { name: 'A', address: 'B', city: 'C' } as any;
    const { result } = renderHook(() => useCreateCinema(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createCinemaMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myCinemas'] });
  });
});
