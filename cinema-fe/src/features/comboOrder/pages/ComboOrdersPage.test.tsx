import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const hasPermissionMock = vi.fn(() => true);
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useCurrentUserMock = vi.fn();
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: (...args: unknown[]) => useCurrentUserMock(...args) }));

const useComboOrdersMock = vi.fn();
vi.mock('../hooks/useComboOrders', () => ({ useComboOrders: (...args: unknown[]) => useComboOrdersMock(...args) }));

const createMutate = vi.fn();
vi.mock('../hooks/useCreateComboOrder', () => ({ useCreateComboOrder: () => ({ mutateAsync: createMutate, isPending: false }) }));
vi.mock('../hooks/usePayComboOrder', () => ({ usePayComboOrder: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../hooks/usePrepareComboOrder', () => ({ usePrepareComboOrder: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../hooks/useReadyComboOrder', () => ({ useReadyComboOrder: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../hooks/useDeliverComboOrder', () => ({ useDeliverComboOrder: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('../hooks/useCancelComboOrder', () => ({ useCancelComboOrder: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

const useCombosMock = vi.fn();
vi.mock('@/features/booking/hooks/useCombos', () => ({ useCombos: (...args: unknown[]) => useCombosMock(...args) }));

const getMyCinemasMock = vi.fn();
vi.mock('@/features/owner/api/owner.api', () => ({ getMyCinemas: (...args: unknown[]) => getMyCinemasMock(...args) }));

import ComboOrdersPage from './ComboOrdersPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: (state = {}) => state });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ComboOrdersPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('ComboOrdersPage — Sell combo entry point', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockReturnValue(true);
    useCurrentUserMock.mockReset();
    useComboOrdersMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 } });
    createMutate.mockReset();
    useCombosMock.mockReset().mockReturnValue({ data: [] });
    getMyCinemasMock.mockReset();
  });

  it('is never disabled for an employee tied to a branch (cinema_id present)', () => {
    useCurrentUserMock.mockReturnValue({ data: { cinema_id: 1 } });
    renderPage();
    expect(screen.getByText('sellButton')).not.toBeDisabled();
  });

  it('opens the sell modal straight to the item picker for an employee (no branch step needed)', () => {
    useCurrentUserMock.mockReturnValue({ data: { cinema_id: 1 } });
    useCombosMock.mockReturnValue({ data: [{ id: 1, name: 'Popcorn Combo', price: 50000, active: true }] });
    renderPage();
    fireEvent.click(screen.getByText('sellButton'));
    expect(screen.queryByText('sellBranchLabel')).not.toBeInTheDocument();
    expect(screen.getByText('Popcorn Combo')).toBeInTheDocument();
  });

  it('is never disabled for an account with combo.sell but no cinema_id (e.g. super admin) — shows a branch picker instead', async () => {
    useCurrentUserMock.mockReturnValue({ data: {} });
    getMyCinemasMock.mockResolvedValue({ data: [{ id: 1, name: 'Branch A' }], total: 1, page: 1, limit: 100, totalPages: 1 });
    renderPage();

    const sellButton = screen.getByText('sellButton');
    expect(sellButton).not.toBeDisabled();

    fireEvent.click(sellButton);
    expect(screen.getByText('sellBranchLabel')).toBeInTheDocument();
    expect(screen.getByText('sellSelectBranchFirst')).toBeInTheDocument();
    await waitFor(() => expect(getMyCinemasMock).toHaveBeenCalled());
  });

  it('does not request the branch list at all when the caller already has a cinema_id', () => {
    useCurrentUserMock.mockReturnValue({ data: { cinema_id: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('sellButton'));
    expect(getMyCinemasMock).not.toHaveBeenCalled();
  });

  it('creates the order using the caller\'s own branch_id when no picker is needed', async () => {
    useCurrentUserMock.mockReturnValue({ data: { cinema_id: 1 } });
    useCombosMock.mockReturnValue({ data: [{ id: 1, name: 'Popcorn Combo', price: 50000, active: true }] });
    createMutate.mockResolvedValue({ id: 1 });
    renderPage();

    fireEvent.click(screen.getByText('sellButton'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('sellSubmit'));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({ branch_id: 1, items: [{ combo_id: 1, quantity: 2 }] }),
    );
  });
});
