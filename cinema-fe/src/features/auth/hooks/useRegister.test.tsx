import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const registerMock = vi.fn();
vi.mock('../api/auth.api', () => ({ register: (...args: unknown[]) => registerMock(...args) }));

import { useRegister } from './useRegister';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRegister', () => {
  beforeEach(() => registerMock.mockReset());

  it('calls the register api with email/password/c_password', async () => {
    registerMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useRegister(), { wrapper });
    result.current.mutate({ email: 'a@b.com', password: 'pw', c_password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(registerMock).toHaveBeenCalledWith('a@b.com', 'pw', 'pw');
  });
});
