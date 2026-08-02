import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAccountsByEmailMock = vi.fn();
const resendCodeMock = vi.fn();
vi.mock('../api/auth.api', () => ({
  getAccountsByEmail: (...args: unknown[]) => getAccountsByEmailMock(...args),
  resendCode: (...args: unknown[]) => resendCodeMock(...args),
}));

import { useResendCode } from './useResendCode';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useResendCode', () => {
  beforeEach(() => {
    getAccountsByEmailMock.mockReset();
    resendCodeMock.mockReset();
  });

  it('resends the code for the first matching account', async () => {
    getAccountsByEmailMock.mockResolvedValue({ data: [{ id: 42 }] });
    resendCodeMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useResendCode(), { wrapper });
    result.current.mutate('a@b.com');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resendCodeMock).toHaveBeenCalledWith(42);
  });

  it('resolves to null without resending when no account matches', async () => {
    getAccountsByEmailMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useResendCode(), { wrapper });
    result.current.mutate('nobody@b.com');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resendCodeMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
