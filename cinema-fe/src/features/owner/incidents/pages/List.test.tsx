import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const useCurrentUserMock = vi.fn();
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => useCurrentUserMock() }));

let granted = new Set<string>();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: (code: string) => granted.has(code) }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useIncidentsMock = vi.fn();
const createMutate = vi.fn();
vi.mock('../../hooks/useIncidents', () => ({
  useIncidents: (...args: unknown[]) => useIncidentsMock(...args),
  useCreateIncident: () => ({ mutateAsync: createMutate, isPending: false }),
}));

import IncidentsPage from './List';

function renderPage(role: number) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { accessToken: 'token', userId: '1', role: String(role), account: null } },
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <IncidentsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Incidents page', () => {
  beforeEach(() => {
    granted = new Set();
    useMyCinemasMock.mockReset();
    useIncidentsMock.mockReset();
    createMutate.mockReset();
    createMutate.mockResolvedValue({});
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Branch A' }] } });
    useCurrentUserMock.mockReturnValue({ data: { cinema_id: 7 } });
    useIncidentsMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
  });

  it('lets a Security employee report an incident at their own branch, without listing cinemas', async () => {
    granted = new Set(['incident.create', 'incident.read']);
    renderPage(ROLES.employee);

    expect(useMyCinemasMock).toHaveBeenCalledWith({ enabled: false });
    expect(useIncidentsMock).toHaveBeenLastCalledWith('7', 1, expect.any(Number));

    fireEvent.change(screen.getByLabelText('incidents.titleLabel'), { target: { value: '  Unattended bag ' } });
    fireEvent.click(screen.getByRole('button', { name: 'incidents.submit' }));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({
        branch_id: 7,
        category: 'OTHER',
        severity: 'LOW',
        title: 'Unattended bag',
        description: undefined,
      }),
    );
  });

  it('does not submit without a title', () => {
    granted = new Set(['incident.create', 'incident.read']);
    renderPage(ROLES.employee);
    fireEvent.click(screen.getByRole('button', { name: 'incidents.submit' }));
    expect(createMutate).not.toHaveBeenCalled();
    expect(screen.getByText('incidents.titleRequired')).toBeInTheDocument();
  });

  it('hides the report form from someone without incident.create and the list without incident.read', () => {
    granted = new Set(['incident.read']);
    renderPage(ROLES.employee);
    expect(screen.queryByRole('button', { name: 'incidents.submit' })).not.toBeInTheDocument();
    expect(screen.getByText('incidents.headers.title')).toBeInTheDocument();
  });

  it('lists the incidents of the selected branch for a branch admin', () => {
    granted = new Set(['incident.read', 'incident.create']);
    useIncidentsMock.mockReturnValue({
      data: {
        data: [
          { id: 3, branch_id: 1, category: 'THEFT', severity: 'HIGH', title: 'Stolen phone', description: 'Lobby', createdAt: '2026-09-25T10:00:00Z' },
        ],
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage(ROLES.owner);
    expect(useMyCinemasMock).toHaveBeenCalledWith({ enabled: true });
    expect(useIncidentsMock).toHaveBeenLastCalledWith('1', 1, expect.any(Number));
    expect(screen.getByText('Stolen phone')).toBeInTheDocument();
    expect(screen.getByText('incidents.severity.HIGH')).toBeInTheDocument();
  });
});
