import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const loginMock = vi.fn();
vi.mock('../api/auth.api', () => ({ login: (...args: unknown[]) => loginMock(...args) }));

import { useLogin } from './useLogin';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useLogin', () => {
  beforeEach(() => loginMock.mockReset());

  it('calls the login api with email and password', async () => {
    loginMock.mockResolvedValue({ data: { accessToken: 'tok' } });
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'a@b.com', password: 'secret' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(loginMock).toHaveBeenCalledWith('a@b.com', 'secret');
  });
});
