import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const changePasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ changePassword: (...args: unknown[]) => changePasswordMock(...args) }));

import { useChangePassword } from './useChangePassword';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useChangePassword', () => {
  beforeEach(() => changePasswordMock.mockReset());

  it('calls changePassword with the payload', async () => {
    changePasswordMock.mockResolvedValue({ data: {} });
    const payload = { currentPassword: 'old', newPassword: 'new', c_password: 'new' };
    const { result } = renderHook(() => useChangePassword(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(changePasswordMock).toHaveBeenCalledWith(payload);
  });
});
