import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAccountByEmailMock = vi.fn();
vi.mock('../api/auth.api', () => ({ getAccountByEmail: (...args: unknown[]) => getAccountByEmailMock(...args) }));

import { useAccountByEmail } from './useAccountByEmail';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAccountByEmail', () => {
  beforeEach(() => getAccountByEmailMock.mockReset());

  it('is disabled when email is null', () => {
    const { result } = renderHook(() => useAccountByEmail(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getAccountByEmailMock).not.toHaveBeenCalled();
  });

  it('fetches the account when an email is provided', async () => {
    getAccountByEmailMock.mockResolvedValue({ data: { id: 1 } });
    const { result } = renderHook(() => useAccountByEmail('a@b.com'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAccountByEmailMock).toHaveBeenCalledWith('a@b.com');
  });
});
