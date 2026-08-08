import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import adminActorsReducer from '../store/adminActorsSlice';

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

const useActorsMock = vi.fn();
vi.mock('../hooks/useActors', () => ({ useActors: (...args: unknown[]) => useActorsMock(...args) }));

const createActorMutate = vi.fn();
const deleteActorMutate = vi.fn();
vi.mock('../hooks/useActorMutations', () => ({
  useCreateActor: () => ({ mutateAsync: createActorMutate, isPending: false }),
  useDeleteActor: () => ({ mutateAsync: deleteActorMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import ActorList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { adminActors: adminActorsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ActorList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Actors List', () => {
  beforeEach(() => {
    useActorsMock.mockReset();
    createActorMutate.mockReset();
    deleteActorMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders actor rows', () => {
    useActorsMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Actor A', nationality: 'US' }], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Actor A')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('deletes an actor after confirming', async () => {
    useActorsMock.mockReturnValue({ data: { data: [{ id: 1, full_name: 'Actor A', nationality: 'US' }], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    deleteActorMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('actors.delete'));
    await waitFor(() => expect(deleteActorMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-actor modal from the add button', () => {
    useActorsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('actors.addButton'));
    expect(screen.getByText('actors.addTitle')).toBeInTheDocument();
  });
});
