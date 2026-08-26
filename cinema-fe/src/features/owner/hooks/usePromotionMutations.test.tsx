import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createPromotionMock = vi.fn();
const updatePromotionMock = vi.fn();
const deletePromotionMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createPromotion: (...args: unknown[]) => createPromotionMock(...args),
  updatePromotion: (...args: unknown[]) => updatePromotionMock(...args),
  deletePromotion: (...args: unknown[]) => deletePromotionMock(...args),
}));

import { useCreatePromotion, useUpdatePromotion, useDeletePromotion } from './usePromotionMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('promotion mutation hooks', () => {
  beforeEach(() => {
    createPromotionMock.mockReset();
    updatePromotionMock.mockReset();
    deletePromotionMock.mockReset();
  });

  it('useCreatePromotion posts the payload as-is and invalidates ownerPromotions', async () => {
    createPromotionMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreatePromotion(), { wrapper });
    const payload = { code: 'A', name: 'A' } as any;
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createPromotionMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPromotions'] });
  });

  it('useUpdatePromotion splits id from the rest of the payload and invalidates ownerPromotions', async () => {
    updatePromotionMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdatePromotion(), { wrapper });
    result.current.mutate({ id: 1, status: 'INACTIVE' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updatePromotionMock).toHaveBeenCalledWith(1, { status: 'INACTIVE' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPromotions'] });
  });

  it('useDeletePromotion deletes and invalidates ownerPromotions', async () => {
    deletePromotionMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeletePromotion(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletePromotionMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPromotions'] });
  });
});
