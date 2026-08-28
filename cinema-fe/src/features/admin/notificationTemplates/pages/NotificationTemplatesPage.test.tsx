import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let canManage = true;
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => canManage }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/features/notifications/toast', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));
const confirmMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmMock(...a) }));

const useTemplatesMock = vi.fn();
const useMetaMock = vi.fn();
vi.mock('../hooks/useNotificationTemplates', () => ({
  useNotificationTemplates: (...a: unknown[]) => useTemplatesMock(...a),
  useNotificationTemplateMeta: (...a: unknown[]) => useMetaMock(...a),
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('../hooks/useNotificationTemplateMutations', () => ({
  useCreateNotificationTemplate: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateNotificationTemplate: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteNotificationTemplate: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

const previewMock = vi.fn();
vi.mock('../api/notificationTemplates.api', () => ({
  previewNotificationTemplate: (...a: unknown[]) => previewMock(...a),
}));

import NotificationTemplatesPage from './NotificationTemplatesPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NotificationTemplatesPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const template = {
  id: 3,
  event: 'TICKET_ISSUED',
  channel: 'EMAIL',
  language: 'vi',
  subject: 'Ticket for {{customer_name}}',
  content: 'Your ticket {{ticket_code}}',
  status: 'ACTIVE',
  description: '',
  updated_by: 1,
  createdAt: '2026-08-27T10:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
};

const meta = {
  events: ['BOOKING_SUCCESS', 'TICKET_ISSUED'],
  channels: ['EMAIL', 'IN_APP', 'SMS'],
  supportedChannels: ['EMAIL', 'IN_APP'],
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
  statuses: ['ACTIVE', 'INACTIVE'],
  variablesByEvent: { TICKET_ISSUED: ['customer_name', 'ticket_code'], BOOKING_SUCCESS: ['customer_name'] },
  sampleVariables: {},
};

describe('NotificationTemplatesPage', () => {
  beforeEach(() => {
    canManage = true;
    useTemplatesMock.mockReset().mockReturnValue({ data: { data: [template], totalPages: 1 }, isLoading: false });
    useMetaMock.mockReset().mockReturnValue({ data: meta });
    createMutate.mockReset().mockResolvedValue({ id: 1 });
    updateMutate.mockReset().mockResolvedValue({ id: 1 });
    deleteMutate.mockReset().mockResolvedValue({});
    confirmMock.mockReset().mockResolvedValue(true);
    previewMock.mockReset().mockResolvedValue({ subject: 'Ticket for Nguyen Van A', content: 'Your ticket TK-1', variablesUsed: [] });
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('renders a template row', () => {
    renderPage();
    expect(screen.getByText('notificationTemplates.events.TICKET_ISSUED')).toBeInTheDocument();
    expect(screen.getByText('EMAIL')).toBeInTheDocument();
  });

  it('selecting an event filter passes it to the hook', () => {
    renderPage();
    const anyButtons = screen.getAllByText('notificationTemplates.filters.any');
    fireEvent.click(anyButtons[0]);
    fireEvent.click(screen.getByText('notificationTemplates.events.BOOKING_SUCCESS'));
    expect(useTemplatesMock).toHaveBeenLastCalledWith(
      1,
      expect.any(Number),
      expect.objectContaining({ event: 'BOOKING_SUCCESS' }),
    );
  });

  it('creates a template from the modal', async () => {
    renderPage();
    fireEvent.click(screen.getByText('notificationTemplates.addButton'));

    // event + channel selects (custom Select renders its options as clickable text)
    fireEvent.click(screen.getByText('notificationTemplates.form.selectEvent'));
    fireEvent.click(screen.getByText('notificationTemplates.events.BOOKING_SUCCESS'));
    fireEvent.click(screen.getByText('notificationTemplates.form.selectChannel'));
    fireEvent.click(screen.getAllByText('IN_APP')[0]);

    fireEvent.change(screen.getByLabelText('notificationTemplates.form.content'), {
      target: { value: 'Hi {{customer_name}}' },
    });
    fireEvent.click(screen.getByText('notificationTemplates.form.submit'));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      event: 'BOOKING_SUCCESS',
      channel: 'IN_APP',
      content: 'Hi {{customer_name}}',
    });
  });

  it('runs a preview against sample data', async () => {
    renderPage();
    fireEvent.click(screen.getByText('notificationTemplates.edit'));
    fireEvent.click(screen.getByText('notificationTemplates.form.preview'));
    await waitFor(() => expect(previewMock).toHaveBeenCalled());
    expect(screen.getByText('Your ticket TK-1')).toBeInTheDocument();
  });

  it('deletes a template after confirmation', async () => {
    renderPage();
    fireEvent.click(screen.getByText('notificationTemplates.delete'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(3));
  });

  it('surfaces per-field validation details from a 400', async () => {
    createMutate.mockRejectedValueOnce({
      response: { data: { code: 'TEMPLATE_INVALID', details: [{ field: 'subject', message: 'subject is required for EMAIL templates' }] } },
    });
    renderPage();
    fireEvent.click(screen.getByText('notificationTemplates.addButton'));
    fireEvent.click(screen.getByText('notificationTemplates.form.selectEvent'));
    fireEvent.click(screen.getByText('notificationTemplates.events.BOOKING_SUCCESS'));
    fireEvent.click(screen.getByText('notificationTemplates.form.selectChannel'));
    fireEvent.click(screen.getAllByText('EMAIL')[1]);
    fireEvent.change(screen.getByLabelText('notificationTemplates.form.content'), { target: { value: 'x {{customer_name}}' } });
    fireEvent.click(screen.getByText('notificationTemplates.form.submit'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('subject is required for EMAIL templates'));
  });

  it('hides management actions without the permission', () => {
    canManage = false;
    renderPage();
    expect(screen.queryByText('notificationTemplates.addButton')).not.toBeInTheDocument();
  });
});
