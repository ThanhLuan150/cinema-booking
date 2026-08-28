import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import { ROLES } from '@/constants/roles';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts && 'count' in opts ? `${opts.count} ${key}` : opts?.label ? `${key} ${opts.label}` : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let role: number = ROLES.admin;
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => role }));
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { cinema_id: 1 } }) }));
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: () => ({ data: { data: [{ id: 1, name: 'Branch A' }, { id: 2, name: 'Branch B' }] } }),
}));

let canManage = true;
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => canManage }) }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@/features/notifications/toast', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));
const confirmMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmMock(...a) }));

const useListMock = vi.fn();
vi.mock('../hooks/useSystemConfig', () => ({
  useSystemConfigList: (...a: unknown[]) => useListMock(...a),
}));

const updateMutate = vi.fn();
const resetMutate = vi.fn();
vi.mock('../hooks/useSystemConfigMutations', () => ({
  useUpdateSystemConfig: () => ({ mutateAsync: updateMutate, isPending: false }),
  useResetSystemConfig: () => ({ mutateAsync: resetMutate, isPending: false }),
}));

import SystemConfigPage from './SystemConfigPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SystemConfigPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function holdTimeSetting(overrides: Record<string, unknown> = {}) {
  return {
    key: 'BOOKING_HOLD_TIME',
    module: 'booking',
    type: 'NUMBER',
    unit: 'minutes',
    label: 'Booking hold time',
    description: 'How long a held seat stays reserved.',
    default: 5,
    min: 1,
    max: 60,
    allowedValues: null,
    branchOverridable: true,
    value: 5,
    source: 'DEFAULT',
    branchId: null,
    id: null,
    ...overrides,
  };
}

function currencySetting(overrides: Record<string, unknown> = {}) {
  return {
    key: 'DEFAULT_CURRENCY',
    module: 'billing',
    type: 'STRING',
    unit: null,
    label: 'Default currency',
    description: 'Currency code.',
    default: 'VND',
    min: null,
    max: null,
    allowedValues: ['VND', 'USD'],
    branchOverridable: false,
    value: 'VND',
    source: 'DEFAULT',
    branchId: null,
    id: null,
    ...overrides,
  };
}

function refundPolicySetting(overrides: Record<string, unknown> = {}) {
  return {
    key: 'REFUND_POLICY',
    module: 'refund',
    type: 'JSON',
    unit: null,
    label: 'Refund policy tiers',
    description: 'Refund tiers.',
    default: [{ minHours: 24, percent: 100 }],
    min: null,
    max: null,
    allowedValues: null,
    branchOverridable: true,
    value: [{ minHours: 24, percent: 100 }],
    source: 'DEFAULT',
    branchId: null,
    id: null,
    ...overrides,
  };
}

describe('SystemConfigPage', () => {
  beforeEach(() => {
    role = ROLES.admin;
    canManage = true;
    useListMock.mockReset().mockReturnValue({ data: { branchId: null, settings: [holdTimeSetting()] }, isLoading: false });
    updateMutate.mockReset().mockResolvedValue({ key: 'BOOKING_HOLD_TIME', value: 10 });
    resetMutate.mockReset().mockResolvedValue({ key: 'BOOKING_HOLD_TIME', value: 5 });
    confirmMock.mockReset().mockResolvedValue(true);
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('renders a setting row with its value and source', () => {
    renderPage();
    expect(screen.getByText('Booking hold time')).toBeInTheDocument();
    expect(screen.getByText('5 minutes')).toBeInTheDocument();
    expect(screen.getByText('systemConfig.source.DEFAULT')).toBeInTheDocument();
  });

  it('as admin, defaults to the Global Settings view (no branchId sent)', () => {
    renderPage();
    expect(useListMock).toHaveBeenLastCalledWith({ branchId: undefined });
  });

  it('as owner, defaults to its own first branch', () => {
    role = ROLES.owner;
    renderPage();
    expect(useListMock).toHaveBeenLastCalledWith({ branchId: '1' });
  });

  it('as owner, the branch selector has no Global Settings option', () => {
    role = ROLES.owner;
    renderPage();
    expect(screen.queryByText('systemConfig.filters.globalSettings')).not.toBeInTheDocument();
  });

  it('switching the branch selector re-queries with the new branchId', () => {
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.filters.globalSettings'));
    fireEvent.click(screen.getByText('Branch B'));
    expect(useListMock).toHaveBeenLastCalledWith({ branchId: '2' });
  });

  it('edits a NUMBER setting and submits the new value at the Global level', async () => {
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.edit'));
    const input = screen.getByLabelText(/systemConfig.form.value/);
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.click(screen.getByText('systemConfig.form.submit'));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate).toHaveBeenCalledWith({ key: 'BOOKING_HOLD_TIME', value: 15, branchId: null });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('edits a STRING (enum) setting via its allowed values', async () => {
    useListMock.mockReturnValue({ data: { branchId: null, settings: [currencySetting()] }, isLoading: false });
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.edit'));
    fireEvent.click(screen.getByLabelText('systemConfig.form.value'));
    fireEvent.click(screen.getByText('USD'));
    fireEvent.click(screen.getByText('systemConfig.form.submit'));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith({ key: 'DEFAULT_CURRENCY', value: 'USD', branchId: null }));
  });

  it('shows Global only and hides Edit for a non-branch-overridable setting in a branch view', () => {
    role = ROLES.owner;
    useListMock.mockReturnValue({
      data: { branchId: 1, settings: [currencySetting({ source: 'DEFAULT' })] },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('systemConfig.globalOnly')).toBeInTheDocument();
    expect(screen.queryByText('systemConfig.edit')).not.toBeInTheDocument();
  });

  it('shows Reset only when the source matches the currently viewed level', () => {
    useListMock.mockReturnValue({
      data: { branchId: null, settings: [holdTimeSetting({ source: 'GLOBAL', id: 3 })] },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('systemConfig.reset')).toBeInTheDocument();
  });

  it('does not show Reset when the value only comes from the default', () => {
    renderPage(); // holdTimeSetting() defaults to source: DEFAULT
    expect(screen.queryByText('systemConfig.reset')).not.toBeInTheDocument();
  });

  it('resets a setting after confirmation', async () => {
    useListMock.mockReturnValue({
      data: { branchId: null, settings: [holdTimeSetting({ source: 'GLOBAL', id: 3 })] },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.reset'));
    await waitFor(() => expect(resetMutate).toHaveBeenCalledWith({ key: 'BOOKING_HOLD_TIME', branchId: undefined }));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('edits a JSON (REFUND_POLICY) setting by adding a tier', async () => {
    useListMock.mockReturnValue({ data: { branchId: null, settings: [refundPolicySetting()] }, isLoading: false });
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.edit'));
    fireEvent.click(screen.getByText('systemConfig.form.addTier'));
    fireEvent.click(screen.getByText('systemConfig.form.submit'));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    const payload = updateMutate.mock.calls[0][0];
    expect(payload.key).toBe('REFUND_POLICY');
    expect(payload.value).toHaveLength(2);
  });

  it('hides management actions without systemConfig.manage', () => {
    canManage = false;
    renderPage();
    expect(screen.queryByText('systemConfig.edit')).not.toBeInTheDocument();
  });

  it('surfaces an error toast when the update is rejected', async () => {
    updateMutate.mockRejectedValueOnce({ response: { data: { message: 'nope' } } });
    renderPage();
    fireEvent.click(screen.getByText('systemConfig.edit'));
    fireEvent.click(screen.getByText('systemConfig.form.submit'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
