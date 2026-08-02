import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const forgotPasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args) }));

import { useForgotPassword } from './useForgotPassword';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useForgotPassword', () => {
  beforeEach(() => forgotPasswordMock.mockReset());

  it('calls forgotPassword with the email', async () => {
    forgotPasswordMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useForgotPassword(), { wrapper });
    result.current.mutate('a@b.com');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(forgotPasswordMock).toHaveBeenCalledWith('a@b.com');
  });
});
