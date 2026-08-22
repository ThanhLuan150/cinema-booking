import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerHolidaysMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerHolidays: (...args: unknown[]) => getOwnerHolidaysMock(...args) }));

import { useOwnerHolidays } from './useOwnerHolidays';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerHolidays', () => {
  beforeEach(() => getOwnerHolidaysMock.mockReset());

  it("fetches the owner's holidays for the given branch/page/limit", async () => {
    getOwnerHolidaysMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerHolidays(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerHolidaysMock).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });
});
