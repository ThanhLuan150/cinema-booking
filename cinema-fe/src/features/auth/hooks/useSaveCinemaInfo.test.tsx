import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveCinemaInfoMock = vi.fn();
vi.mock('../api/auth.api', () => ({ saveCinemaInfo: (...args: unknown[]) => saveCinemaInfoMock(...args) }));

import { useSaveCinemaInfo } from './useSaveCinemaInfo';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSaveCinemaInfo', () => {
  beforeEach(() => saveCinemaInfoMock.mockReset());

  it('calls saveCinemaInfo with the payload', async () => {
    saveCinemaInfoMock.mockResolvedValue({ data: {} });
    const payload = new FormData();
    payload.append('name', 'A');
    const { result } = renderHook(() => useSaveCinemaInfo(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveCinemaInfoMock).toHaveBeenCalledWith(payload);
  });
});
