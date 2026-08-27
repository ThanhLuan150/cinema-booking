import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createSupportTicketMock = vi.fn();
const updateSupportTicketMock = vi.fn();
const claimSupportTicketMock = vi.fn();
const assignSupportTicketMock = vi.fn();
const resolveSupportTicketMock = vi.fn();
const closeSupportTicketMock = vi.fn();
const deleteSupportTicketMock = vi.fn();
vi.mock('../api/customerService.api', () => ({
  createSupportTicket: (...args: unknown[]) => createSupportTicketMock(...args),
  updateSupportTicket: (...args: unknown[]) => updateSupportTicketMock(...args),
  claimSupportTicket: (...args: unknown[]) => claimSupportTicketMock(...args),
  assignSupportTicket: (...args: unknown[]) => assignSupportTicketMock(...args),
  resolveSupportTicket: (...args: unknown[]) => resolveSupportTicketMock(...args),
  closeSupportTicket: (...args: unknown[]) => closeSupportTicketMock(...args),
  deleteSupportTicket: (...args: unknown[]) => deleteSupportTicketMock(...args),
}));

import {
  useAssignSupportTicket,
  useClaimSupportTicket,
  useCloseSupportTicket,
  useCreateSupportTicket,
  useDeleteSupportTicket,
  useResolveSupportTicket,
  useUpdateSupportTicket,
} from './useSupportTicketMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('useSupportTicketMutations', () => {
  beforeEach(() => {
    createSupportTicketMock.mockReset();
    updateSupportTicketMock.mockReset();
    claimSupportTicketMock.mockReset();
    assignSupportTicketMock.mockReset();
    resolveSupportTicketMock.mockReset();
    closeSupportTicketMock.mockReset();
    deleteSupportTicketMock.mockReset();
  });

  it('useCreateSupportTicket creates and invalidates', async () => {
    createSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper, invalidateSpy } = makeWrapper();
    const payload = { branch_id: 1, customer_id: 10, subject: 'Help' };
    const { result } = renderHook(() => useCreateSupportTicket(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createSupportTicketMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['supportTickets'] });
  });

  it('useUpdateSupportTicket updates by id', async () => {
    updateSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateSupportTicket(), { wrapper });
    result.current.mutate({ id: 1, subject: 'New' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSupportTicketMock).toHaveBeenCalledWith(1, { subject: 'New' });
  });

  it('useClaimSupportTicket claims by id', async () => {
    claimSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useClaimSupportTicket(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(claimSupportTicketMock).toHaveBeenCalledWith(1);
  });

  it('useAssignSupportTicket assigns an employee', async () => {
    assignSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAssignSupportTicket(), { wrapper });
    result.current.mutate({ id: 1, employee_id: 5 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignSupportTicketMock).toHaveBeenCalledWith(1, { employee_id: 5 });
  });

  it('useResolveSupportTicket resolves with a note', async () => {
    resolveSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResolveSupportTicket(), { wrapper });
    result.current.mutate({ id: 1, resolution_note: 'Fixed' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resolveSupportTicketMock).toHaveBeenCalledWith(1, { resolution_note: 'Fixed' });
  });

  it('useCloseSupportTicket closes by id', async () => {
    closeSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCloseSupportTicket(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(closeSupportTicketMock).toHaveBeenCalledWith(1);
  });

  it('useDeleteSupportTicket deletes by id', async () => {
    deleteSupportTicketMock.mockResolvedValue({ data: {} });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteSupportTicket(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteSupportTicketMock).toHaveBeenCalledWith(1);
  });
});
