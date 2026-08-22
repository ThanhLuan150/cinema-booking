import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createPricingRuleMock = vi.fn();
const updatePricingRuleMock = vi.fn();
const deletePricingRuleMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createPricingRule: (...args: unknown[]) => createPricingRuleMock(...args),
  updatePricingRule: (...args: unknown[]) => updatePricingRuleMock(...args),
  deletePricingRule: (...args: unknown[]) => deletePricingRuleMock(...args),
}));

import { useCreatePricingRule, useUpdatePricingRule, useDeletePricingRule } from './usePricingRuleMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('pricing rule mutation hooks', () => {
  beforeEach(() => {
    createPricingRuleMock.mockReset();
    updatePricingRuleMock.mockReset();
    deletePricingRuleMock.mockReset();
  });

  it('useCreatePricingRule posts the payload as-is and invalidates ownerPricingRules', async () => {
    createPricingRuleMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreatePricingRule(), { wrapper });
    const payload = { name: 'A', price: 80000 } as any;
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createPricingRuleMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPricingRules'] });
  });

  it('useUpdatePricingRule splits id from the rest of the payload and invalidates ownerPricingRules', async () => {
    updatePricingRuleMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdatePricingRule(), { wrapper });
    result.current.mutate({ id: 1, active: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updatePricingRuleMock).toHaveBeenCalledWith(1, { active: false });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPricingRules'] });
  });

  it('useDeletePricingRule deletes and invalidates ownerPricingRules', async () => {
    deletePricingRuleMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeletePricingRule(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletePricingRuleMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerPricingRules'] });
  });
});
