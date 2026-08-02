import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const resetPasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ resetPassword: (...args: unknown[]) => resetPasswordMock(...args) }));

import { useResetPassword } from './useResetPassword';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useResetPassword', () => {
  beforeEach(() => resetPasswordMock.mockReset());

  it('calls resetPassword with the payload', async () => {
    resetPasswordMock.mockResolvedValue({ data: {} });
    const payload = { email: 'a@b.com', otp: '123456', password: 'p', c_password: 'p' };
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resetPasswordMock).toHaveBeenCalledWith(payload);
  });
});
