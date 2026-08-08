import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import adminDirectorsReducer from '../store/adminDirectorsSlice';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useDirectorsMock = vi.fn();
vi.mock('../hooks/useDirectors', () => ({ useDirectors: (...args: unknown[]) => useDirectorsMock(...args) }));

const createDirectorMutate = vi.fn();
const deleteDirectorMutate = vi.fn();
vi.mock('../hooks/useDirectorMutations', () => ({
  useCreateDirector: () => ({ mutateAsync: createDirectorMutate, isPending: false }),
  useDeleteDirector: () => ({ mutateAsync: deleteDirectorMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import DirectorList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { adminDirectors: adminDirectorsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DirectorList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Directors List', () => {
  beforeEach(() => {
    useDirectorsMock.mockReset();
    createDirectorMutate.mockReset();
    deleteDirectorMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders director rows', () => {
    useDirectorsMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Director A', nationality: 'US' }], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Director A')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('deletes a director after confirming', async () => {
    useDirectorsMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Director A', nationality: 'US' }], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    deleteDirectorMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('directors.delete'));
    await waitFor(() => expect(deleteDirectorMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-director modal from the add button', () => {
    useDirectorsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('directors.addButton'));
    expect(screen.getByText('directors.addTitle')).toBeInTheDocument();
  });
});
