import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getDistributorsMock = vi.fn();
const getAllDistributorsMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../api/distribution.api', () => ({
  getDistributors: (...a: unknown[]) => getDistributorsMock(...a),
  getAllDistributors: (...a: unknown[]) => getAllDistributorsMock(...a),
  createDistributor: (...a: unknown[]) => createMock(...a),
  updateDistributor: (...a: unknown[]) => updateMock(...a),
  deleteDistributor: (...a: unknown[]) => deleteMock(...a),
}));

import {
  useAllDistributors,
  useCreateDistributor,
  useDistributors,
  useUpdateDistributor,
} from './useDistributors';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useDistributors hooks', () => {
  beforeEach(() => {
    getDistributorsMock.mockReset().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    getAllDistributorsMock.mockReset().mockResolvedValue([]);
    createMock.mockReset().mockResolvedValue({ id: 1 });
    updateMock.mockReset().mockResolvedValue({ id: 1 });
    deleteMock.mockReset().mockResolvedValue({});
  });

  it('useDistributors merges filters + pagination into one query param object', async () => {
    const { result } = renderHook(() => useDistributors({ search: 'cgv', status: 'ACTIVE' }, { page: 2, limit: 10 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDistributorsMock).toHaveBeenCalledWith({ search: 'cgv', status: 'ACTIVE', page: 2, limit: 10 });
  });

  it('useAllDistributors forwards a status filter', async () => {
    const { result } = renderHook(() => useAllDistributors('ACTIVE'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAllDistributorsMock).toHaveBeenCalledWith('ACTIVE');
  });

  it('useCreateDistributor posts the payload', async () => {
    const { result } = renderHook(() => useCreateDistributor(), { wrapper });
    await result.current.mutateAsync({ name: 'CGV', code: 'CGV' });
    expect(createMock).toHaveBeenCalledWith({ name: 'CGV', code: 'CGV' });
  });

  it('useUpdateDistributor splits id from the payload', async () => {
    const { result } = renderHook(() => useUpdateDistributor(), { wrapper });
    await result.current.mutateAsync({ id: 5, name: 'New' });
    expect(updateMock).toHaveBeenCalledWith(5, { name: 'New' });
  });
});
