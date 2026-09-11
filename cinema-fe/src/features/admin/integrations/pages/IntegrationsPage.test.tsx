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
      t: (key: string, opts?: Record<string, unknown>) =>
        opts?.name ? `${key} ${opts.name}` : opts?.id !== undefined ? `${key} ${opts.id}` : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let permissions = new Set<string>();
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (code: string) => permissions.has(code) }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: () => Promise.resolve(true) }));

const useIntegrationsMock = vi.fn();
const createIntegrationMutate = vi.fn();
vi.mock('../hooks/useIntegrations', () => ({
  useIntegrations: (...a: unknown[]) => useIntegrationsMock(...a),
  useCreateIntegration: () => ({ mutateAsync: createIntegrationMutate, isPending: false }),
  useUpdateIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIntegration: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const useWebhooksMock = vi.fn();
const retryWebhookMutate = vi.fn();
vi.mock('../hooks/useWebhooks', () => ({
  useWebhooks: (...a: unknown[]) => useWebhooksMock(...a),
  useRetryWebhook: () => ({ mutateAsync: retryWebhookMutate, isPending: false }),
}));

import IntegrationsPage from './IntegrationsPage';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <IntegrationsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const emptyPage = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };

describe('IntegrationsPage', () => {
  beforeEach(() => {
    permissions = new Set(['integration.read']);
    useIntegrationsMock.mockReset().mockReturnValue({
      data: {
        ...emptyPage,
        data: [{ id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY', status: 'ACTIVE' }],
      },
      isLoading: false,
    });
    useWebhooksMock.mockReset().mockReturnValue({
      data: {
        ...emptyPage,
        data: [
          { id: 1, provider: 'MOMO', event: 'payment.success', status: 'SUCCESS', attempts: 1, max_attempts: 5 },
          { id: 2, provider: 'MOMO', event: 'payment.failed', status: 'FAILED', attempts: 3, max_attempts: 5, last_error: 'boom' },
        ],
      },
      isLoading: false,
    });
    createIntegrationMutate.mockReset().mockResolvedValue({ id: 2 });
    retryWebhookMutate.mockReset().mockResolvedValue({ id: 2, status: 'SUCCESS' });
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it('lists integrations and hides the add button without integration.manage', () => {
    renderPage();
    expect(screen.getByText('MoMo Wallet')).toBeInTheDocument();
    expect(screen.queryByText('integrations.addButton')).not.toBeInTheDocument();
  });

  it('shows the add button and lets a manager create an integration', async () => {
    permissions = new Set(['integration.read', 'integration.manage']);
    renderPage();
    fireEvent.click(screen.getByText('integrations.addButton'));

    fireEvent.change(screen.getByLabelText('integrations.fields.name'), { target: { value: 'SendGrid' } });
    fireEvent.change(screen.getByLabelText('integrations.fields.provider'), { target: { value: 'sendgrid' } });
    fireEvent.click(screen.getByText('integrations.save'));

    await waitFor(() => expect(createIntegrationMutate).toHaveBeenCalled());
    expect(createIntegrationMutate.mock.calls[0][0]).toMatchObject({ name: 'SendGrid', provider: 'SENDGRID' });
  });

  it('blocks creating an integration with a missing name/provider', async () => {
    permissions = new Set(['integration.read', 'integration.manage']);
    renderPage();
    fireEvent.click(screen.getByText('integrations.addButton'));
    fireEvent.click(screen.getByText('integrations.save'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(createIntegrationMutate).not.toHaveBeenCalled();
  });

  it('switches to the Webhooks tab and only shows Retry for a FAILED row', () => {
    renderPage();
    fireEvent.click(screen.getByText('integrations.tabs.webhooks'));

    const retryButtons = screen.getAllByText('integrations.webhooks.retry');
    expect(retryButtons).toHaveLength(1);
  });

  it('retries a failed webhook', async () => {
    renderPage();
    fireEvent.click(screen.getByText('integrations.tabs.webhooks'));
    fireEvent.click(screen.getByText('integrations.webhooks.retry'));
    await waitFor(() => expect(retryWebhookMutate).toHaveBeenCalledWith(2));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('opens the webhook detail modal showing the last error', () => {
    renderPage();
    fireEvent.click(screen.getByText('integrations.tabs.webhooks'));
    const viewButtons = screen.getAllByText('integrations.webhooks.viewDetail');
    fireEvent.click(viewButtons[1]);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
