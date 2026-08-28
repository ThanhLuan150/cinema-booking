import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getTemplatesMock = vi.fn();
const getMetaMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('../api/notificationTemplates.api', () => ({
  getNotificationTemplates: (...a: unknown[]) => getTemplatesMock(...a),
  getNotificationTemplateMeta: (...a: unknown[]) => getMetaMock(...a),
  createNotificationTemplate: (...a: unknown[]) => createMock(...a),
  updateNotificationTemplate: (...a: unknown[]) => updateMock(...a),
  deleteNotificationTemplate: (...a: unknown[]) => deleteMock(...a),
}));

import { useNotificationTemplates, useNotificationTemplateMeta } from './useNotificationTemplates';
import {
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
  useDeleteNotificationTemplate,
} from './useNotificationTemplateMutations';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const emptyPage = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };

describe('notificationTemplates hooks', () => {
  beforeEach(() => {
    getTemplatesMock.mockReset().mockResolvedValue(emptyPage);
    getMetaMock.mockReset().mockResolvedValue({ events: ['BOOKING_SUCCESS'], supportedChannels: ['EMAIL', 'IN_APP'] });
    createMock.mockReset().mockResolvedValue({ id: 1 });
    updateMock.mockReset().mockResolvedValue({ id: 1 });
    deleteMock.mockReset().mockResolvedValue({});
  });

  it('useNotificationTemplates forwards page/limit/filters', async () => {
    const { result } = renderHook(
      () => useNotificationTemplates(2, 10, { event: 'BOOKING_SUCCESS', channel: 'EMAIL' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTemplatesMock).toHaveBeenCalledWith({ page: 2, limit: 10, event: 'BOOKING_SUCCESS', channel: 'EMAIL' });
  });

  it('useNotificationTemplateMeta loads the vocabulary', async () => {
    const { result } = renderHook(() => useNotificationTemplateMeta(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.events).toContain('BOOKING_SUCCESS');
  });

  it('useCreateNotificationTemplate calls the api', async () => {
    const { result } = renderHook(() => useCreateNotificationTemplate(), { wrapper });
    await result.current.mutateAsync({ event: 'BOOKING_SUCCESS', channel: 'IN_APP', content: 'x' });
    expect(createMock).toHaveBeenCalledWith({ event: 'BOOKING_SUCCESS', channel: 'IN_APP', content: 'x' });
  });

  it('useUpdateNotificationTemplate splits id from the payload', async () => {
    const { result } = renderHook(() => useUpdateNotificationTemplate(), { wrapper });
    await result.current.mutateAsync({ id: 5, status: 'INACTIVE' });
    expect(updateMock).toHaveBeenCalledWith(5, { status: 'INACTIVE' });
  });

  it('useDeleteNotificationTemplate calls the api with the id', async () => {
    const { result } = renderHook(() => useDeleteNotificationTemplate(), { wrapper });
    await result.current.mutateAsync(9);
    expect(deleteMock).toHaveBeenCalledWith(9);
  });
});
