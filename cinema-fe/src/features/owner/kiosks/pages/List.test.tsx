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
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let role: number = ROLES.owner;
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => role }));
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { cinema_id: 1 } }) }));
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: () => ({ data: { data: [{ id: 1, name: 'Branch A' }] } }),
}));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useKiosksMock = vi.fn();
vi.mock('../hooks/useKiosks', () => ({ useKiosks: (...a: unknown[]) => useKiosksMock(...a) }));

const createKiosk = vi.fn();
const updateKiosk = vi.fn();
const rotateKey = vi.fn();
const deleteKiosk = vi.fn();
vi.mock('../hooks/useKioskMutations', () => ({
  useCreateKiosk: () => ({ mutateAsync: createKiosk, isPending: false }),
  useUpdateKiosk: () => ({ mutateAsync: updateKiosk, isPending: false }),
  useRotateKioskKey: () => ({ mutateAsync: rotateKey, isPending: false }),
  useDeleteKiosk: () => ({ mutateAsync: deleteKiosk, isPending: false }),
}));

vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import KiosksList from './List';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <KiosksList />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('KiosksList', () => {
  beforeEach(() => {
    role = ROLES.owner;
    hasPermissionMock.mockReset().mockReturnValue(true);
    createKiosk.mockReset();
    useKiosksMock.mockReset().mockReturnValue({
      data: {
        data: [{ id: 1, kiosk_code: 'KSK-1', name: 'Lobby', branch_id: 1, status: 'ACTIVE', last_seen_at: null }],
        totalPages: 1,
      },
      isLoading: false,
    });
  });

  it('lists the branch kiosks', () => {
    renderPage();
    expect(screen.getByText('KSK-1')).toBeInTheDocument();
    expect(screen.getByText('Lobby')).toBeInTheDocument();
  });

  it('registers a kiosk and reveals the api key once', async () => {
    createKiosk.mockResolvedValue({ kiosk_code: 'KSK-2', api_key: 'KIOSK-secret' });
    renderPage();
    fireEvent.click(screen.getByText('kiosks.addButton'));
    fireEvent.change(screen.getByLabelText('kiosks.kioskCodeLabel'), { target: { value: 'KSK-2' } });
    fireEvent.change(screen.getByLabelText('kiosks.nameLabel'), { target: { value: 'Gate kiosk' } });
    fireEvent.click(screen.getByText('kiosks.submit'));
    await waitFor(() =>
      expect(createKiosk).toHaveBeenCalledWith({ branch_id: 1, kiosk_code: 'KSK-2', name: 'Gate kiosk', status: 'ACTIVE' }),
    );
    expect(await screen.findByText('KIOSK-secret')).toBeInTheDocument();
  });

  it('hides management actions without kiosk.create', () => {
    hasPermissionMock.mockReturnValue(false);
    renderPage();
    expect(screen.queryByText('kiosks.addButton')).not.toBeInTheDocument();
  });
});
