import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const redeemPointsMock = vi.fn();
vi.mock('../api/membership.api', () => ({ redeemPoints: (...args: unknown[]) => redeemPointsMock(...args) }));

import { useRedeemPoints } from './useRedeemPoints';

describe('useRedeemPoints', () => {
  beforeEach(() => redeemPointsMock.mockReset());

  it('redeems points and invalidates the membership summary + history queries', async () => {
    redeemPointsMock.mockResolvedValue({ transaction: { id: 1, points: -200 }, redeemValue: 20000 });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRedeemPoints(), { wrapper });
    result.current.mutate({ points: 200, description: 'Voucher' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(redeemPointsMock).toHaveBeenCalledWith(200, 'Voucher');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myMembership'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myPointsHistory'] });
  });
});
