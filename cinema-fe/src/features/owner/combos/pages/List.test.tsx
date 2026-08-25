import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerCombosReducer from '../../store/ownerCombosSlice';

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

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));

const useOwnerCombosMock = vi.fn();
vi.mock('../../hooks/useOwnerCombos', () => ({
  useOwnerCombos: (...args: unknown[]) => useOwnerCombosMock(...args),
}));

const createComboMutate = vi.fn();
const updateComboMutate = vi.fn();
const deleteComboMutate = vi.fn();
vi.mock('../../hooks/useComboMutations', () => ({
  useCreateCombo: () => ({ mutateAsync: createComboMutate, isPending: false }),
  useUpdateCombo: () => ({ mutateAsync: updateComboMutate }),
  useDeleteCombo: () => ({ mutateAsync: deleteComboMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import ComboList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerCombos: ownerCombosReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ComboList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Combos List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerCombosMock.mockReset();
    createComboMutate.mockReset();
    updateComboMutate.mockReset();
    deleteComboMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders combo rows with cinema name, type and status', () => {
    useOwnerCombosMock.mockReturnValue({
      data: {
        data: [{ id: 1, cinema_id: 1, name: 'Combo A', price: 50000, active: true, type: 'FOOD' }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Combo A')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('combos.typeFood')).toBeInTheDocument();
    expect(screen.getByText('combos.statusActive')).toBeInTheDocument();
  });

  it('toggles a combo active state', async () => {
    useOwnerCombosMock.mockReturnValue({
      data: { data: [{ id: 1, cinema_id: 1, name: 'Combo A', price: 50000, active: true }], totalPages: 1 },
    });
    updateComboMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('combos.deactivate'));
    await waitFor(() => expect(updateComboMutate).toHaveBeenCalledWith({ id: 1, active: false }));
  });

  it('deletes a combo after confirming', async () => {
    useOwnerCombosMock.mockReturnValue({
      data: { data: [{ id: 1, cinema_id: 1, name: 'Combo A', price: 50000, active: false }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteComboMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('combos.delete'));
    await waitFor(() => expect(deleteComboMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-combo modal from the add button', () => {
    useOwnerCombosMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('combos.addButton'));
    expect(screen.getByText('combos.addTitle')).toBeInTheDocument();
  });

  it('defaults the new combo to type COMBO and prompts for a cinema before showing items', () => {
    useOwnerCombosMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('combos.addButton'));
    expect(screen.getByText('combos.typeCombo')).toBeInTheDocument();
    expect(screen.getByText('combos.itemsSelectCinemaFirst')).toBeInTheDocument();
  });
});
