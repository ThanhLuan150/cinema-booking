import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCategoriesListMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getCategoriesList: () => getCategoriesListMock() }));

import { useCategories } from './useCategories';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCategories', () => {
  beforeEach(() => getCategoriesListMock.mockReset());

  it('fetches the category list', async () => {
    getCategoriesListMock.mockResolvedValue([{ id: 1, name: 'Action' }]);
    const { result } = renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1, name: 'Action' }]);
  });
});
