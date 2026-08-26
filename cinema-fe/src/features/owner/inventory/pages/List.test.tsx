import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerInventoryReducer from '../../store/ownerInventorySlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts && 'count' in opts ? `${key} ${opts.count}` : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useOwnerCombosMock = vi.fn();
vi.mock('../../hooks/useOwnerCombos', () => ({ useOwnerCombos: (...args: unknown[]) => useOwnerCombosMock(...args) }));

const useComboComponentsMock = vi.fn();
vi.mock('../../hooks/useComboComponents', () => ({
  useComboComponents: (...args: unknown[]) => useComboComponentsMock(...args),
}));

const useOwnerInventoryMock = vi.fn();
vi.mock('../../hooks/useOwnerInventory', () => ({
  useOwnerInventory: (...args: unknown[]) => useOwnerInventoryMock(...args),
}));

const useInventoryAlertsMock = vi.fn();
vi.mock('../../hooks/useInventoryAlerts', () => ({
  useInventoryAlerts: (...args: unknown[]) => useInventoryAlertsMock(...args),
}));

const useInventoryHistoryMock = vi.fn();
vi.mock('../../hooks/useInventoryHistory', () => ({
  useInventoryHistory: (...args: unknown[]) => useInventoryHistoryMock(...args),
}));

const createMutate = vi.fn();
const deleteMutate = vi.fn();
const receiveMutate = vi.fn();
const adjustMutate = vi.fn();
const deductMutate = vi.fn();
vi.mock('../../hooks/useInventoryMutations', () => ({
  useCreateInventory: () => ({ mutateAsync: createMutate, isPending: false }),
  useDeleteInventory: () => ({ mutateAsync: deleteMutate }),
  useReceiveInventory: () => ({ mutateAsync: receiveMutate, isPending: false }),
  useAdjustInventory: () => ({ mutateAsync: adjustMutate, isPending: false }),
  useDeductInventory: () => ({ mutateAsync: deductMutate, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import InventoryList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerInventory: ownerInventoryReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <InventoryList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Inventory List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerCombosMock.mockReset();
    useComboComponentsMock.mockReset();
    useOwnerInventoryMock.mockReset();
    useInventoryAlertsMock.mockReset();
    useInventoryHistoryMock.mockReset();
    createMutate.mockReset();
    deleteMutate.mockReset();
    receiveMutate.mockReset();
    adjustMutate.mockReset();
    deductMutate.mockReset();
    confirmDialogMock.mockReset();

    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useOwnerCombosMock.mockReturnValue({ data: { data: [{ id: 5, name: 'Popcorn Combo' }] } });
    useComboComponentsMock.mockReturnValue({ data: { data: [] } });
    useInventoryAlertsMock.mockReturnValue({ data: [] });
    useInventoryHistoryMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
  });

  it('renders inventory rows with cinema name, linked combo name, and status', () => {
    useOwnerInventoryMock.mockReturnValue({
      data: {
        data: [
          { id: 1, branch_id: 1, combo_id: 5, item: 'Popcorn', quantity: 40, minimum_quantity: 10, unit: 'pcs', status: 'IN_STOCK' },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Popcorn')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('Popcorn Combo')).toBeInTheDocument();
    expect(screen.getByText('inventory.statusInStock')).toBeInTheDocument();
  });

  it('shows a not-linked placeholder when combo_id is null', () => {
    useOwnerInventoryMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Flour', quantity: 5, minimum_quantity: 10, unit: 'kg', status: 'LOW_STOCK' }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('inventory.notLinked')).toBeInTheDocument();
    expect(screen.getByText('inventory.statusLowStock')).toBeInTheDocument();
  });

  it('shows the low-stock alert banner when there are alerts', () => {
    useOwnerInventoryMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    useInventoryAlertsMock.mockReturnValue({ data: [{ id: 1 }, { id: 2 }] });
    renderPage();
    expect(screen.getByText('inventory.alertsBanner 2')).toBeInTheDocument();
  });

  it('does not show the alert banner when nothing is low on stock', () => {
    useOwnerInventoryMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText(/alertsBanner/)).not.toBeInTheDocument();
  });

  it('opens the add-item modal from the add button', () => {
    useOwnerInventoryMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('inventory.addButton'));
    expect(screen.getByText('inventory.addTitle')).toBeInTheDocument();
  });

  it('deletes an item after confirming', async () => {
    useOwnerInventoryMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 5, minimum_quantity: 1, unit: 'pcs', status: 'IN_STOCK' }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('inventory.delete'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
  });

  it('opens the receive-stock modal and submits a quantity', async () => {
    useOwnerInventoryMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 5, minimum_quantity: 1, unit: 'pcs', status: 'IN_STOCK' }], totalPages: 1 },
    });
    receiveMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('inventory.receive'));
    expect(screen.getByText('inventory.stockAction.receiveTitle')).toBeInTheDocument();

    const quantityInput = document.querySelector('input[name="quantity"]') as HTMLInputElement;
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.click(screen.getByText('inventory.stockAction.submit'));
    await waitFor(() => expect(receiveMutate).toHaveBeenCalledWith({ id: 1, quantity: 10, reason: undefined }));
  });

  it('opens the history modal for an item', () => {
    useOwnerInventoryMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 5, minimum_quantity: 1, unit: 'pcs', status: 'IN_STOCK' }], totalPages: 1 },
    });
    renderPage();
    fireEvent.click(screen.getByText('inventory.historyButton'));
    expect(screen.getByText('inventory.history.title')).toBeInTheDocument();
  });
});
