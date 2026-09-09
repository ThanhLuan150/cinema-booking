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
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: () => ({ data: { data: [] } }) }));
vi.mock('@/features/admin/schedules/hooks/useSchedules', () => ({ useSchedules: () => ({ data: { data: [] } }) }));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useScreensMock = vi.fn();
const useScreenPlaybackMock = vi.fn();
const useSignageContentsMock = vi.fn();
const useSignageSchedulesMock = vi.fn();
vi.mock('../hooks/useScreens', () => ({
  useScreens: (...a: unknown[]) => useScreensMock(...a),
  useScreenPlayback: (...a: unknown[]) => useScreenPlaybackMock(...a),
}));
vi.mock('../hooks/useSignageContents', () => ({ useSignageContents: (...a: unknown[]) => useSignageContentsMock(...a) }));
vi.mock('../hooks/useSignageSchedules', () => ({ useSignageSchedules: (...a: unknown[]) => useSignageSchedulesMock(...a) }));

const createScreen = vi.fn();
const updateScreen = vi.fn();
const rotateScreenKey = vi.fn();
const deleteScreen = vi.fn();
const createContent = vi.fn();
const updateContent = vi.fn();
const deleteContent = vi.fn();
const createEntry = vi.fn();
const updateEntry = vi.fn();
const deleteEntry = vi.fn();
vi.mock('../hooks/useSignageMutations', () => ({
  useCreateScreen: () => ({ mutateAsync: createScreen, isPending: false }),
  useUpdateScreen: () => ({ mutateAsync: updateScreen, isPending: false }),
  useRotateScreenKey: () => ({ mutateAsync: rotateScreenKey, isPending: false }),
  useDeleteScreen: () => ({ mutateAsync: deleteScreen, isPending: false }),
  useCreateContent: () => ({ mutateAsync: createContent, isPending: false }),
  useUpdateContent: () => ({ mutateAsync: updateContent, isPending: false }),
  useDeleteContent: () => ({ mutateAsync: deleteContent, isPending: false }),
  useCreateSignageSchedule: () => ({ mutateAsync: createEntry, isPending: false }),
  useUpdateSignageSchedule: () => ({ mutateAsync: updateEntry, isPending: false }),
  useDeleteSignageSchedule: () => ({ mutateAsync: deleteEntry, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...a: unknown[]) => confirmDialogMock(...a) }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SignageList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SignageList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function screenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    branch_id: 1,
    name: 'Lobby wall',
    location: 'North',
    device_id: 'PLAYER-1',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('SignageList', () => {
  beforeEach(() => {
    role = ROLES.owner;
    hasPermissionMock.mockReset().mockReturnValue(true);
    useScreensMock.mockReset().mockReturnValue({ data: { data: [screenRow()], totalPages: 1 } });
    useScreenPlaybackMock.mockReset().mockReturnValue({ data: undefined, isLoading: false });
    useSignageContentsMock.mockReset().mockReturnValue({ data: { data: [] } });
    useSignageSchedulesMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 } });
    [createScreen, updateScreen, rotateScreenKey, deleteScreen, createContent, deleteContent, createEntry, confirmDialogMock].forEach(
      (m) => m.mockReset(),
    );
  });

  it('renders a screen row', () => {
    renderPage();
    expect(screen.getByText('Lobby wall')).toBeInTheDocument();
    expect(screen.getByText('PLAYER-1')).toBeInTheDocument();
  });

  it('hides management actions without signage.manage', () => {
    hasPermissionMock.mockReturnValue(false);
    renderPage();
    expect(screen.queryByText('signage.addScreen')).not.toBeInTheDocument();
    // read-only viewers still get playlist + preview
    expect(screen.getByText('signage.playlist')).toBeInTheDocument();
    expect(screen.getByText('signage.preview')).toBeInTheDocument();
  });

  it('creates a screen on the picked branch and reveals the key once', async () => {
    createScreen.mockResolvedValue({ id: 2, name: 'Concessions', api_key: 'SCR-secret' });
    renderPage();
    fireEvent.click(screen.getByText('signage.addScreen'));
    fireEvent.change(screen.getByLabelText('signage.nameLabel'), { target: { value: 'Concessions' } });
    fireEvent.click(screen.getByText('signage.submit'));
    await vi.waitFor(() =>
      expect(createScreen).toHaveBeenCalledWith(expect.objectContaining({ branch_id: 1, name: 'Concessions' })),
    );
    expect(await screen.findByText('SCR-secret')).toBeInTheDocument();
  });

  it('rotates a screen key after confirmation', async () => {
    confirmDialogMock.mockResolvedValue(true);
    rotateScreenKey.mockResolvedValue({ api_key: 'SCR-rotated' });
    renderPage();
    fireEvent.click(screen.getByText('signage.rotateKey'));
    await vi.waitFor(() => expect(rotateScreenKey).toHaveBeenCalledWith(1));
    expect(await screen.findByText('SCR-rotated')).toBeInTheDocument();
  });

  it('deletes a screen after confirmation', async () => {
    confirmDialogMock.mockResolvedValue(true);
    deleteScreen.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('signage.delete'));
    await vi.waitFor(() => expect(deleteScreen).toHaveBeenCalledWith(1));
  });

  it('opens the live preview modal', () => {
    useScreenPlaybackMock.mockReturnValue({
      data: { screen: {}, generated_at: new Date().toISOString(), items: [], dropped: [] },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('signage.preview'));
    expect(screen.getByText('signage.previewEmpty')).toBeInTheDocument();
  });
});
