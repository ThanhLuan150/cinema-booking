import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createEmployeeMock = vi.fn();
const updateEmployeeMock = vi.fn();
const deactivateEmployeeMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createEmployee: (...args: unknown[]) => createEmployeeMock(...args),
  updateEmployee: (...args: unknown[]) => updateEmployeeMock(...args),
  deactivateEmployee: (...args: unknown[]) => deactivateEmployeeMock(...args),
}));

import { useCreateEmployee, useUpdateEmployee, useDeactivateEmployee } from './useEmployeeMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('employee mutation hooks', () => {
  beforeEach(() => {
    createEmployeeMock.mockReset();
    updateEmployeeMock.mockReset();
    deactivateEmployeeMock.mockReset();
  });

  it('useCreateEmployee coerces cinema_id to a number and invalidates myEmployees', async () => {
    createEmployeeMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateEmployee(), { wrapper });
    result.current.mutate({
      cinema_id: '5',
      email: 'a@b.com',
      password: 'pw',
      name: 'A',
      phone: '0123',
      position: 'Cashier',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createEmployeeMock).toHaveBeenCalledWith({
      cinema_id: 5,
      email: 'a@b.com',
      password: 'pw',
      name: 'A',
      phone: '0123',
      position: 'Cashier',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myEmployees'] });
  });

  it('useUpdateEmployee updates status and invalidates myEmployees', async () => {
    updateEmployeeMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateEmployee(), { wrapper });
    result.current.mutate({ id: 1, status: 0 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateEmployeeMock).toHaveBeenCalledWith(1, { status: 0 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myEmployees'] });
  });

  it('useDeactivateEmployee deactivates and invalidates myEmployees', async () => {
    deactivateEmployeeMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeactivateEmployee(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deactivateEmployeeMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myEmployees'] });
  });
});
