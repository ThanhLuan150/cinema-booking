import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const saveUserInfoMock = vi.fn();
vi.mock('../api/auth.api', () => ({ saveUserInfo: (...args: unknown[]) => saveUserInfoMock(...args) }));

import { useSaveUserInfo } from './useSaveUserInfo';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSaveUserInfo', () => {
  beforeEach(() => saveUserInfoMock.mockReset());

  it('calls saveUserInfo with the payload', async () => {
    saveUserInfoMock.mockResolvedValue({ data: {} });
    const payload = { name: 'A', phone: '123', email: 'a@b.com' };
    const { result } = renderHook(() => useSaveUserInfo(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveUserInfoMock).toHaveBeenCalledWith(payload);
  });
});
