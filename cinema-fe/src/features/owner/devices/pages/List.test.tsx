import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const useDevicesMock = vi.fn();
const useEntrancesMock = vi.fn();
const useCheckinLogsMock = vi.fn();
vi.mock('../hooks/useDevices', () => ({ useDevices: (...a: unknown[]) => useDevicesMock(...a) }));
vi.mock('../hooks/useEntrances', () => ({ useEntrances: (...a: unknown[]) => useEntrancesMock(...a) }));
vi.mock('../hooks/useCheckinLogs', () => ({ useCheckinLogs: (...a: unknown[]) => useCheckinLogsMock(...a) }));

const createDevice = vi.fn();
const updateDevice = vi.fn();
const rotateKey = vi.fn();
const deleteDevice = vi.fn();
const createEntrance = vi.fn();
const updateEntrance = vi.fn();
const deleteEntrance = vi.fn();
vi.mock('../hooks/useDeviceMutations', () => ({
  useCreateDevice: () => ({ mutateAsync: createDevice, isPending: false }),
  useUpdateDevice: () => ({ mutateAsync: updateDevice, isPending: false }),
  useRotateDeviceKey: () => ({ mutateAsync: rotateKey, isPending: false }),
  useDeleteDevice: () => ({ mutateAsync: deleteDevice, isPending: false }),
  useCreateEntrance: () => ({ mutateAsync: createEntrance, isPending: false }),
  useUpdateEntrance: () => ({ mutateAsync: updateEntrance, isPending: false }),
  useDeleteEntrance: () => ({ mutateAsync: deleteEntrance, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmDialogMock(...a) }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DevicesList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DevicesList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    device_id: 'SCN-A-01',
    name: 'Lobby scanner',
    branch_id: 1,
    entrance_id: null,
    status: 'ACTIVE',
    last_seen_at: null,
    ...overrides,
  };
}

describe('DevicesList', () => {
  beforeEach(() => {
    role = ROLES.owner;
    hasPermissionMock.mockReset().mockReturnValue(true);
    useDevicesMock.mockReset().mockReturnValue({ data: { data: [device()], totalPages: 1 } });
    useEntrancesMock.mockReset().mockReturnValue({ data: { data: [] } });
    useCheckinLogsMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 } });
    createDevice.mockReset();
    rotateKey.mockReset();
    deleteDevice.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders a device row', () => {
    renderPage();
    expect(screen.getByText('SCN-A-01')).toBeInTheDocument();
    expect(screen.getByText('Lobby scanner')).toBeInTheDocument();
  });

  it('hides management actions without device.create permission', () => {
    hasPermissionMock.mockReturnValue(false);
    renderPage();
    expect(screen.queryByText('devices.addButton')).not.toBeInTheDocument();
    expect(screen.queryByText('devices.rotateKey')).not.toBeInTheDocument();
    // the logs action is always available
    expect(screen.getByText('devices.viewLogs')).toBeInTheDocument();
  });

  it('registers a scanner and reveals the api key once', async () => {
    createDevice.mockResolvedValue({ device_id: 'SCN-NEW', api_key: 'DEV-secret' });
    renderPage();
    fireEvent.click(screen.getByText('devices.addButton'));
    fireEvent.change(screen.getByLabelText('devices.deviceIdLabel'), { target: { value: 'SCN-NEW' } });
    fireEvent.change(screen.getByLabelText('devices.nameLabel'), { target: { value: 'New scanner' } });
    fireEvent.click(screen.getByText('devices.submit'));
    await vi.waitFor(() =>
      expect(createDevice).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 1, device_id: 'SCN-NEW', name: 'New scanner' }),
      ),
    );
    expect(await screen.findByText('DEV-secret')).toBeInTheDocument();
  });

  it('rotates a key after confirmation', async () => {
    confirmDialogMock.mockResolvedValue(true);
    rotateKey.mockResolvedValue({ api_key: 'DEV-rotated' });
    renderPage();
    fireEvent.click(screen.getByText('devices.rotateKey'));
    await vi.waitFor(() => expect(rotateKey).toHaveBeenCalledWith(1));
    expect(await screen.findByText('DEV-rotated')).toBeInTheDocument();
  });

  it('deletes a scanner after confirmation', async () => {
    confirmDialogMock.mockResolvedValue(true);
    deleteDevice.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('devices.delete'));
    await vi.waitFor(() => expect(deleteDevice).toHaveBeenCalledWith(1));
  });

  it('as admin defaults to all-branches and hides the register button until a branch is picked', () => {
    role = ROLES.admin;
    renderPage();
    expect(screen.queryByText('devices.addButton')).not.toBeInTheDocument();
    expect(screen.getByText('devices.headers.branch')).toBeInTheDocument();
  });
});
