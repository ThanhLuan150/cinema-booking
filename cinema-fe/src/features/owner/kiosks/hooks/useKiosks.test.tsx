import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getKiosksMock = vi.fn();
vi.mock('../api/kiosks.api', () => ({ getKiosks: (...a: unknown[]) => getKiosksMock(...a) }));

import { useKiosks } from './useKiosks';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useKiosks', () => {
  beforeEach(() => getKiosksMock.mockReset().mockResolvedValue({ data: [], total: 0, totalPages: 1 }));

  it('is disabled until a branch is chosen', () => {
    renderHook(() => useKiosks(undefined, 1, 10), { wrapper });
    expect(getKiosksMock).not.toHaveBeenCalled();
  });

  it('fetches with branch + pagination + filters once a branch is set', async () => {
    renderHook(() => useKiosks(3, 2, 10, { status: 'ACTIVE' }), { wrapper });
    await waitFor(() => expect(getKiosksMock).toHaveBeenCalledWith(3, { page: 2, limit: 10, status: 'ACTIVE' }));
  });
});
