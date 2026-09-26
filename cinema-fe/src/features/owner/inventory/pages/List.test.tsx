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
let grantedPermissions: Set<string> | null = null; // null = grant everything (Branch Admin)
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (code: string) => grantedPermissions === null || grantedPermissions.has(code) }),
}));

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

const useInventoryCategoriesMock = vi.fn();
vi.mock('../../hooks/useInventoryCategories', () => ({
  useInventoryCategories: (...args: unknown[]) => useInventoryCategoriesMock(...args),
}));

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const importMutate = vi.fn();
const returnMutate = vi.fn();
const adjustMutate = vi.fn();
const wasteMutate = vi.fn();
vi.mock('../../hooks/useInventoryMutations', () => ({
  useCreateInventory: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateInventory: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteInventory: () => ({ mutateAsync: deleteMutate }),
  useImportInventory: () => ({ mutateAsync: importMutate, isPending: false }),
  useReturnInventory: () => ({ mutateAsync: returnMutate, isPending: false }),
  useAdjustInventory: () => ({ mutateAsync: adjustMutate, isPending: false }),
  useWasteInventory: () => ({ mutateAsync: wasteMutate, isPending: false }),
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));

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
    grantedPermissions = null;
    useMyCinemasMock.mockReset();
    useOwnerCombosMock.mockReset();
    useComboComponentsMock.mockReset();
    useOwnerInventoryMock.mockReset();
    useInventoryAlertsMock.mockReset();
    useInventoryHistoryMock.mockReset();
    createMutate.mockReset();
    deleteMutate.mockReset();
    updateMutate.mockReset();
    importMutate.mockReset();
    returnMutate.mockReset();
    adjustMutate.mockReset();
    wasteMutate.mockReset();
    useInventoryCategoriesMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    confirmDialogMock.mockReset();

    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useOwnerCombosMock.mockReturnValue({ data: { data: [{ id: 5, name: 'Popcorn Combo' }] } });
    useComboComponentsMock.mockReturnValue({ data: { data: [] } });
    useInventoryAlertsMock.mockReturnValue({ data: [] });
    useInventoryHistoryMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    useInventoryCategoriesMock.mockReturnValue({ data: ['Beverage', 'Food'] });
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

  it('is read-only for an Employee holding only inventory.view: no branch list fetch, no write actions', () => {
    grantedPermissions = new Set(['inventory.view']);
    useOwnerInventoryMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 40, minimum_quantity: 10, unit: 'pcs', status: 'IN_STOCK' }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Popcorn')).toBeInTheDocument();
    expect(screen.getByText('inventory.historyButton')).toBeInTheDocument();
    for (const key of [
      'inventory.addButton',
      'inventory.import',
      'inventory.return',
      'inventory.adjust',
      'inventory.waste',
      'inventory.edit',
      'inventory.delete',
    ]) {
      expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
    expect(useMyCinemasMock).toHaveBeenCalledWith({ enabled: false });
  });

  it('shows a not-linked placeholder when combo_id is null', () => {
    useOwnerInventoryMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Flour', quantity: 5, minimum_quantity: 10, unit: 'kg', status: 'LOW_STOCK' }],
        totalPages: 1,
      },
    });
    renderPage();
    // Neither the combo link nor the (legacy, missing) category is set.
    expect(screen.getAllByText('inventory.notLinked').length).toBeGreaterThanOrEqual(1);
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

  it('opens the import-stock modal and submits a quantity', async () => {
    useOwnerInventoryMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 5, minimum_quantity: 1, unit: 'pcs', status: 'IN_STOCK' }], totalPages: 1 },
    });
    importMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('inventory.import'));
    expect(screen.getByText('inventory.stockAction.importTitle')).toBeInTheDocument();

    const quantityInput = document.querySelector('input[name="quantity"]') as HTMLInputElement;
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.click(screen.getByText('inventory.stockAction.submit'));
    await waitFor(() => expect(importMutate).toHaveBeenCalledWith({ id: 1, quantity: 10, reason: undefined }));
    expect(toastMock.success).toHaveBeenCalledWith('inventory.stockAction.importSuccess');
  });

  it('opens the history modal for an item', () => {
    useOwnerInventoryMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, combo_id: null, item: 'Popcorn', quantity: 5, minimum_quantity: 1, unit: 'pcs', status: 'IN_STOCK' }], totalPages: 1 },
    });
    renderPage();
    fireEvent.click(screen.getByText('inventory.historyButton'));
    expect(screen.getByText('inventory.history.title')).toBeInTheDocument();
  });

  describe('Ticket 45 product catalogue and stock movements', () => {
    const popcorn = {
      id: 1,
      branch_id: 1,
      combo_id: 5,
      item: 'Popcorn',
      sku: 'POP-L',
      category: 'Food',
      quantity: 7,
      minimum_quantity: 10,
      unit: 'pcs',
      cost_price: 18000,
      selling_price: 55000,
      status: 'LOW_STOCK',
    };
    const listOf = (...rows: unknown[]) => useOwnerInventoryMock.mockReturnValue({ data: { data: rows, totalPages: 1 } });

    it('shows SKU, category, cost and selling price for each product', () => {
      listOf(popcorn);
      renderPage();
      expect(screen.getByText('POP-L')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText((18000).toLocaleString())).toBeInTheDocument();
      expect(screen.getByText((55000).toLocaleString())).toBeInTheDocument();
    });

    it('renders a legacy row that has no SKU, category or prices without breaking', () => {
      listOf({ id: 2, branch_id: 1, combo_id: null, item: 'Flour', quantity: 5, minimum_quantity: 1, unit: 'kg', status: 'IN_STOCK' });
      renderPage();
      expect(screen.getByText('Flour')).toBeInTheDocument();
    });

    it('marks the quantity of a low-stock item so it stands out', () => {
      listOf(popcorn, { ...popcorn, id: 2, item: 'Cups', quantity: 500, status: 'IN_STOCK' });
      renderPage();
      expect(screen.getByText('7')).toHaveClass('text-amber-300');
      expect(screen.getByText('500')).not.toHaveClass('text-amber-300');
    });

    it.each([
      ['inventory.return', 'inventory.stockAction.returnTitle', returnMutate, 'inventory.stockAction.returnSuccess'],
      ['inventory.waste', 'inventory.stockAction.wasteTitle', wasteMutate, 'inventory.stockAction.wasteSuccess'],
    ])('the %s action opens its modal and submits to its own mutation', async (button, title, mutate, success) => {
      listOf(popcorn);
      mutate.mockResolvedValue({});
      renderPage();
      fireEvent.click(screen.getByText(button));
      expect(screen.getByText(title)).toBeInTheDocument();

      fireEvent.change(document.querySelector('input[name="quantity"]') as HTMLInputElement, { target: { value: '3' } });
      fireEvent.change(document.querySelector('input[name="reason"]') as HTMLInputElement, { target: { value: ' spoiled ' } });
      fireEvent.click(screen.getByText('inventory.stockAction.submit'));
      await waitFor(() => expect(mutate).toHaveBeenCalledWith({ id: 1, quantity: 3, reason: 'spoiled' }));
      expect(toastMock.success).toHaveBeenCalledWith(success);
    });

    it('adjust accepts a counted zero; import rejects zero with a validation message', async () => {
      listOf(popcorn);
      adjustMutate.mockResolvedValue({});
      renderPage();

      fireEvent.click(screen.getByText('inventory.adjust'));
      fireEvent.change(document.querySelector('input[name="quantity"]') as HTMLInputElement, { target: { value: '0' } });
      fireEvent.click(screen.getByText('inventory.stockAction.submit'));
      await waitFor(() => expect(adjustMutate).toHaveBeenCalledWith({ id: 1, quantity: 0, reason: undefined }));
    });

    it('a rejected stock movement shows the translated server error and stays open', async () => {
      listOf(popcorn);
      wasteMutate.mockRejectedValue({
        response: { data: { code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock', item: 'Popcorn', requested: 99, available: 7 } },
      });
      renderPage();
      fireEvent.click(screen.getByText('inventory.waste'));
      fireEvent.change(document.querySelector('input[name="quantity"]') as HTMLInputElement, { target: { value: '99' } });
      fireEvent.click(screen.getByText('inventory.stockAction.submit'));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
      expect(screen.getByText('inventory.stockAction.wasteTitle')).toBeInTheDocument();
    });

    it('does not submit a non-positive quantity to import', async () => {
      listOf(popcorn);
      renderPage();
      fireEvent.click(screen.getByText('inventory.import'));
      fireEvent.change(document.querySelector('input[name="quantity"]') as HTMLInputElement, { target: { value: '0' } });
      fireEvent.click(screen.getByText('inventory.stockAction.submit'));
      expect(await screen.findByText('inventory.validation.stockQuantityRequired')).toBeInTheDocument();
      expect(importMutate).not.toHaveBeenCalled();
    });

    it('edits catalogue details (never quantity) through the edit modal', async () => {
      listOf(popcorn);
      updateMutate.mockResolvedValue({});
      renderPage();
      fireEvent.click(screen.getByText('inventory.edit'));
      expect(screen.getByText('inventory.editTitle')).toBeInTheDocument();
      expect(document.querySelector('input[name="quantity"]')).toBeNull();
      expect((document.querySelector('input[name="sku"]') as HTMLInputElement).value).toBe('POP-L');

      fireEvent.change(document.querySelector('input[name="selling_price"]') as HTMLInputElement, { target: { value: '60000' } });
      fireEvent.click(screen.getByText('inventory.save'));
      await waitFor(() =>
        expect(updateMutate).toHaveBeenCalledWith({
          id: 1,
          values: expect.objectContaining({ item: 'Popcorn', sku: 'POP-L', combo_id: '5', selling_price: 60000 }), // Formik turns a number input's value into a number
        }),
      );
      expect(toastMock.success).toHaveBeenCalledWith('inventory.updateSuccess');
    });

    it('the edit modal blocks an invalid SKU and negative price', async () => {
      listOf(popcorn);
      renderPage();
      fireEvent.click(screen.getByText('inventory.edit'));
      fireEvent.change(document.querySelector('input[name="sku"]') as HTMLInputElement, { target: { value: 'bad sku' } });
      fireEvent.change(document.querySelector('input[name="cost_price"]') as HTMLInputElement, { target: { value: '-5' } });
      fireEvent.click(screen.getByText('inventory.save'));
      expect(await screen.findByText('inventory.validation.skuInvalid')).toBeInTheDocument();
      expect(screen.getByText('inventory.validation.priceInvalid')).toBeInTheDocument();
      expect(updateMutate).not.toHaveBeenCalled();
    });

    it('creating an item validates the new catalogue fields and submits them', async () => {
      listOf();
      createMutate.mockResolvedValue({});
      renderPage();
      fireEvent.click(screen.getByText('inventory.addButton'));

      fireEvent.click(screen.getByText('inventory.addTitle').closest('div')!.querySelector('button[type="submit"]') ?? screen.getByText('inventory.submit'));
      expect(await screen.findByText('inventory.validation.cinemaRequired')).toBeInTheDocument();
      expect(screen.getByText('inventory.validation.itemRequired')).toBeInTheDocument();
      expect(createMutate).not.toHaveBeenCalled();
    });

    it('sends the search text (debounced) and status/category filters to the query', async () => {
      listOf(popcorn);
      renderPage();
      expect(useOwnerInventoryMock).toHaveBeenLastCalledWith(1, expect.any(Number), {
        status: undefined,
        q: undefined,
        category: undefined,
      });

      fireEvent.change(screen.getByLabelText('inventory.filters.searchLabel'), { target: { value: '  pop ' } });
      await waitFor(() =>
        expect(useOwnerInventoryMock).toHaveBeenLastCalledWith(1, expect.any(Number), expect.objectContaining({ q: 'pop' })),
      );

      fireEvent.click(screen.getByLabelText('inventory.filters.statusLabel'));
      fireEvent.click(screen.getByRole('option', { name: 'inventory.statusLowStock' }));
      await waitFor(() =>
        expect(useOwnerInventoryMock).toHaveBeenLastCalledWith(
          1,
          expect.any(Number),
          expect.objectContaining({ status: 'LOW_STOCK', q: 'pop' }),
        ),
      );

      fireEvent.click(screen.getByLabelText('inventory.filters.categoryLabel'));
      fireEvent.click(screen.getByRole('option', { name: 'Beverage' }));
      await waitFor(() =>
        expect(useOwnerInventoryMock).toHaveBeenLastCalledWith(
          1,
          expect.any(Number),
          expect.objectContaining({ category: 'Beverage', status: 'LOW_STOCK', q: 'pop' }),
        ),
      );
    });

    it('the history modal filters by movement type and labels legacy rows correctly', () => {
      listOf(popcorn);
      useInventoryHistoryMock.mockReturnValue({
        data: {
          totalPages: 1,
          data: [
            { id: 1, type: 'SALE', quantity_change: -2, quantity_before: 9, quantity_after: 7, reason: '', ref_type: 'COMBO_ORDER', createdAt: '2026-01-01T00:00:00Z' },
            { id: 2, type: 'DEDUCT', quantity_change: -1, quantity_before: 10, quantity_after: 9, reason: 'old sale', ref_type: 'COMBO_ORDER', createdAt: '2026-01-01T00:00:00Z' },
            { id: 3, type: 'DEDUCT', quantity_change: -1, quantity_before: 11, quantity_after: 10, reason: 'spoiled', ref_type: null, createdAt: '2026-01-01T00:00:00Z' },
            { id: 4, type: 'RECEIVE', quantity_change: 5, quantity_before: 6, quantity_after: 11, reason: '', ref_type: null, createdAt: '2026-01-01T00:00:00Z' },
          ],
        },
      });
      renderPage();
      fireEvent.click(screen.getByText('inventory.historyButton'));

      // Two sales (one written before the rename), one waste, one import — labelled by the new names.
      expect(screen.getAllByText('inventory.history.typeSale')).toHaveLength(2);
      expect(screen.getByText('inventory.history.typeImport')).toBeInTheDocument();
      // 'typeWaste' shows once as a table cell (the filter list is closed).
      expect(screen.getAllByText('inventory.history.typeWaste')).toHaveLength(1);

      fireEvent.click(screen.getByLabelText('inventory.history.filterLabel'));
      fireEvent.click(screen.getByRole('option', { name: 'inventory.history.typeReturn' }));
      expect(useInventoryHistoryMock).toHaveBeenLastCalledWith(1, 1, expect.any(Number), 'RETURN');
    });
  });
});
