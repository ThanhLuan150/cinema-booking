import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createVoucherMock = vi.fn();
const updateVoucherMock = vi.fn();
const deleteVoucherMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createVoucher: (...args: unknown[]) => createVoucherMock(...args),
  updateVoucher: (...args: unknown[]) => updateVoucherMock(...args),
  deleteVoucher: (...args: unknown[]) => deleteVoucherMock(...args),
}));

import { useCreateVoucher, useUpdateVoucher, useDeleteVoucher } from './useVoucherMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('voucher mutation hooks', () => {
  beforeEach(() => {
    createVoucherMock.mockReset();
    updateVoucherMock.mockReset();
    deleteVoucherMock.mockReset();
  });

  it('useCreateVoucher coerces numeric fields and invalidates ownerVouchers', async () => {
    createVoucherMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateVoucher(), { wrapper });
    result.current.mutate({
      code: 'SAVE10',
      discount_type: 'fixed',
      discount_value: '10000',
      min_order_value: '',
    } as any);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createVoucherMock).toHaveBeenCalledWith({
      code: 'SAVE10',
      discount_type: 'fixed',
      discount_value: 10000,
      min_order_value: 0,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerVouchers'] });
  });

  it('useUpdateVoucher toggles active and invalidates ownerVouchers', async () => {
    updateVoucherMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateVoucher(), { wrapper });
    result.current.mutate({ id: 1, active: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateVoucherMock).toHaveBeenCalledWith(1, { active: false });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerVouchers'] });
  });

  it('useDeleteVoucher deletes and invalidates ownerVouchers', async () => {
    deleteVoucherMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteVoucher(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteVoucherMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerVouchers'] });
  });
});
