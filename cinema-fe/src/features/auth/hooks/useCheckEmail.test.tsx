import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const checkEmailExistsMock = vi.fn();
vi.mock('../api/auth.api', () => ({ checkEmailExists: (...args: unknown[]) => checkEmailExistsMock(...args) }));

import { useCheckEmail } from './useCheckEmail';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCheckEmail', () => {
  beforeEach(() => checkEmailExistsMock.mockReset());

  it('calls checkEmailExists with the given email', async () => {
    checkEmailExistsMock.mockResolvedValue({ data: { exists: true } });
    const { result } = renderHook(() => useCheckEmail(), { wrapper });
    result.current.mutate('a@b.com');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(checkEmailExistsMock).toHaveBeenCalledWith('a@b.com');
  });
});
