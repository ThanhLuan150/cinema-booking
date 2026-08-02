import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const verifyCodeMock = vi.fn();
vi.mock('../api/auth.api', () => ({ verifyCode: (...args: unknown[]) => verifyCodeMock(...args) }));

import { useVerifyCode } from './useVerifyCode';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useVerifyCode', () => {
  beforeEach(() => verifyCodeMock.mockReset());

  it('calls verifyCode with the payload', async () => {
    verifyCodeMock.mockResolvedValue({ data: {} });
    const payload = { email: 'a@b.com', otp: '123456' };
    const { result } = renderHook(() => useVerifyCode(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(verifyCodeMock).toHaveBeenCalledWith(payload);
  });
});
