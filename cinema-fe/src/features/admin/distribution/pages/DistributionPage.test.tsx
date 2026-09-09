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
      t: (key: string, opts?: Record<string, unknown>) => (opts?.name ? `${key} ${opts.name}` : key),
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

let permissions = new Set<string>();
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (code: string) => permissions.has(code) }),
}));

vi.mock('@/features/admin/movies/hooks/useMyMovies', () => ({
  useMyMovies: () => ({ data: { data: [{ id: 7, name: 'Dune' }] } }),
}));

const toastError = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m) },
}));
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: () => Promise.resolve(true) }));

const useDistributorsMock = vi.fn();
const useAllDistributorsMock = vi.fn();
const createDistributorMutate = vi.fn();
vi.mock('../hooks/useDistributors', () => ({
  useDistributors: (...a: unknown[]) => useDistributorsMock(...a),
  useAllDistributors: (...a: unknown[]) => useAllDistributorsMock(...a),
  useCreateDistributor: () => ({ mutateAsync: createDistributorMutate, isPending: false }),
  useUpdateDistributor: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteDistributor: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const useMovieReleasesMock = vi.fn();
const createReleaseMutate = vi.fn();
vi.mock('../hooks/useMovieReleases', () => ({
  useMovieReleases: (...a: unknown[]) => useMovieReleasesMock(...a),
  useCreateMovieRelease: () => ({ mutateAsync: createReleaseMutate, isPending: false }),
  useUpdateMovieRelease: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMovieRelease: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import DistributionPage from './DistributionPage';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DistributionPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const emptyPage = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };

describe('DistributionPage', () => {
  beforeEach(() => {
    permissions = new Set(['movieRelease.read']);
    useDistributorsMock.mockReset().mockReturnValue({ data: emptyPage, isLoading: false });
    useAllDistributorsMock.mockReset().mockReturnValue({ data: [{ id: 1, name: 'CGV', code: 'CGV' }] });
    useMovieReleasesMock.mockReset().mockReturnValue({
      data: {
        ...emptyPage,
        data: [
          {
            id: 10,
            movie_id: 7,
            distributor_id: 1,
            release_date: '2026-02-01',
            end_date: null,
            status: 'ACTIVE',
            movie: { id: 7, name: 'Dune' },
            distributor: { id: 1, name: 'CGV', code: 'CGV' },
          },
        ],
      },
      isLoading: false,
    });
    createReleaseMutate.mockReset().mockResolvedValue({ id: 11 });
    toastError.mockReset();
  });

  it('shows only the Releases view for a branch admin (no distributor.read)', () => {
    renderPage();
    expect(screen.queryByText('distribution.tabs.distributors')).not.toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.getByText('CGV (CGV)')).toBeInTheDocument();
    expect(screen.getByText('distribution.releases.openEnded')).toBeInTheDocument();
  });

  it('hides the "Add release" button without movieRelease.manage', () => {
    renderPage();
    expect(screen.queryByText('distribution.releases.addButton')).not.toBeInTheDocument();
  });

  it('shows both tabs and management controls for a super admin', () => {
    permissions = new Set(['movieRelease.read', 'movieRelease.manage', 'distributor.read', 'distributor.manage']);
    renderPage();
    expect(screen.getByText('distribution.tabs.distributors')).toBeInTheDocument();
    expect(screen.getByText('distribution.releases.addButton')).toBeInTheDocument();
    fireEvent.click(screen.getByText('distribution.tabs.distributors'));
    expect(screen.getByText('distribution.distributors.addButton')).toBeInTheDocument();
  });

  it('blocks submitting a release whose end date precedes the release date', async () => {
    permissions = new Set(['movieRelease.read', 'movieRelease.manage']);
    renderPage();
    fireEvent.click(screen.getByText('distribution.releases.addButton'));
    fireEvent.change(screen.getByLabelText('distribution.releases.fields.releaseDate'), {
      target: { value: '2026-05-01' },
    });
    fireEvent.change(screen.getByLabelText('distribution.releases.fields.endDate'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByText('distribution.save'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(createReleaseMutate).not.toHaveBeenCalled();
  });
});
