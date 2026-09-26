import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import type { PurchaseOrder } from '@/types/entities';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
let grantedPermissions: Set<string> | null = null; // null = grant everything (Branch Admin)
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (code: string) => grantedPermissions === null || grantedPermissions.has(code),
  }),
}));

const useMyCinemasMock = vi.fn();
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));
vi.mock('@/features/admin/suppliers/hooks/useSuppliers', () => ({
  useAllSuppliers: () => ({
    data: [{ id: 2, name: 'Acme Foods', code: 'ACME', status: 'ACTIVE' }],
  }),
}));

const usePurchaseOrdersMock = vi.fn();
const confirmMutate = vi.fn();
const cancelMutate = vi.fn();
const deleteMutate = vi.fn();
const receiveMutate = vi.fn();
vi.mock('../hooks/usePurchaseOrders', () => ({
  usePurchaseOrders: (...args: unknown[]) => usePurchaseOrdersMock(...args),
  useBranchProducts: () => ({ data: [] }),
  useCreatePurchaseOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePurchaseOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmPurchaseOrder: () => ({ mutateAsync: confirmMutate, isPending: false }),
  useCancelPurchaseOrder: () => ({ mutateAsync: cancelMutate, isPending: false }),
  useDeletePurchaseOrder: () => ({ mutateAsync: deleteMutate, isPending: false }),
  useReceivePurchaseOrder: () => ({ mutateAsync: receiveMutate, isPending: false }),
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));
const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({
  confirmDialog: (...args: unknown[]) => confirmDialogMock(...args),
}));

import PurchaseOrdersList from './List';

const order = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 1,
  code: 'PO-000001',
  supplier_id: 2,
  supplier: { id: 2, name: 'Acme Foods', code: 'ACME', status: 'ACTIVE' },
  branch_id: 1,
  order_date: '2026-10-10T00:00:00.000Z',
  expected_date: '2026-10-15T00:00:00.000Z',
  status: 'ORDERED',
  total_amount: 3800,
  items: [
    {
      inventory_id: 1,
      item: 'Popcorn',
      sku: 'POP',
      unit: 'kg',
      quantity: 20,
      unit_cost: 90,
      line_total: 1800,
    },
    {
      inventory_id: 2,
      item: 'Cola',
      sku: null,
      unit: 'can',
      quantity: 100,
      unit_cost: 20,
      line_total: 2000,
    },
  ],
  note: '',
  ordered_at: null,
  received_at: null,
  cancelled_at: null,
  cancel_reason: '',
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  ...overrides,
});

function renderPage() {
  const store = configureStore({ reducer: { auth: (s = {}) => s } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PurchaseOrdersList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const listOf = (...orders: PurchaseOrder[]) =>
  usePurchaseOrdersMock.mockReturnValue({
    data: { data: orders, totalPages: 1 },
    isLoading: false,
  });
const openDetail = () => fireEvent.click(screen.getByText('purchaseOrders.view'));
const hasAction = (key: string) =>
  screen.queryByRole('button', { name: `purchaseOrders.${key}` }) !== null;

describe('Owner Purchase Orders list', () => {
  beforeEach(() => {
    grantedPermissions = null;
    [
      usePurchaseOrdersMock,
      useMyCinemasMock,
      confirmMutate,
      cancelMutate,
      deleteMutate,
      receiveMutate,
      confirmDialogMock,
    ].forEach((m) => m.mockReset());
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders each order with supplier, branch, status and total', () => {
    listOf(order());
    renderPage();
    expect(screen.getByText('PO-000001')).toBeInTheDocument();
    expect(screen.getByText('Acme Foods')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('purchaseOrders.status.ORDERED')).toBeInTheDocument();
    expect(screen.getByText(/3[.,]800/)).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    listOf();
    renderPage();
    expect(screen.getByText('purchaseOrders.empty')).toBeInTheDocument();
  });

  describe('a Branch Admin (manage + receive)', () => {
    it('can start a new order', () => {
      listOf();
      renderPage();
      expect(screen.getByRole('button', { name: 'purchaseOrders.addButton' })).toBeInTheDocument();
    });

    it('sees edit / confirm / delete / cancel on a DRAFT, but no receive', () => {
      listOf(order({ status: 'DRAFT' }));
      renderPage();
      openDetail();
      expect(
        hasAction('edit') &&
          hasAction('confirmOrder') &&
          hasAction('delete') &&
          hasAction('cancelOrder'),
      ).toBe(true);
      expect(hasAction('receiveStock')).toBe(false);
    });

    it('sees receive + cancel on an ORDERED order, but cannot edit or confirm it again', () => {
      listOf(order({ status: 'ORDERED' }));
      renderPage();
      openDetail();
      expect(hasAction('receiveStock') && hasAction('cancelOrder')).toBe(true);
      expect(hasAction('edit') || hasAction('confirmOrder') || hasAction('delete')).toBe(false);
    });

    it.each(['RECEIVED', 'CANCELLED'] as const)('sees no action at all on a %s order', (status) => {
      listOf(order({ status }));
      renderPage();
      openDetail();
      for (const key of ['edit', 'confirmOrder', 'delete', 'cancelOrder', 'receiveStock'])
        expect(hasAction(key)).toBe(false);
    });

    it('shows every line and the total in the detail', () => {
      listOf(order());
      renderPage();
      openDetail();
      expect(screen.getByText('Popcorn')).toBeInTheDocument();
      expect(screen.getByText('Cola')).toBeInTheDocument();
      expect(screen.getByText('purchaseOrders.orderedHint')).toBeInTheDocument();
    });
  });

  describe('an Employee granted only read + receive', () => {
    beforeEach(() => {
      grantedPermissions = new Set(['purchaseOrder.read', 'purchaseOrder.receive']);
    });

    it('cannot create orders', () => {
      listOf(order());
      renderPage();
      expect(screen.queryByRole('button', { name: 'purchaseOrders.addButton' })).toBeNull();
    });

    it('can receive an ORDERED order but not cancel it', () => {
      listOf(order({ status: 'ORDERED' }));
      renderPage();
      openDetail();
      expect(hasAction('receiveStock')).toBe(true);
      expect(hasAction('cancelOrder')).toBe(false);
    });

    it('has no action on a DRAFT', () => {
      listOf(order({ status: 'DRAFT' }));
      renderPage();
      openDetail();
      for (const key of ['edit', 'confirmOrder', 'delete', 'cancelOrder', 'receiveStock'])
        expect(hasAction(key)).toBe(false);
    });
  });

  describe('an Employee with read only (no receive permission)', () => {
    it('can look but not receive, cancel or create', () => {
      grantedPermissions = new Set(['purchaseOrder.read']);
      listOf(order({ status: 'ORDERED' }));
      renderPage();
      expect(screen.queryByRole('button', { name: 'purchaseOrders.addButton' })).toBeNull();
      openDetail();
      expect(hasAction('receiveStock')).toBe(false);
      expect(hasAction('cancelOrder')).toBe(false);
    });
  });

  describe('receiving stock', () => {
    it('asks first, and does nothing when declined', async () => {
      listOf(order());
      confirmDialogMock.mockResolvedValue(false);
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.receiveStock' }));
      await waitFor(() =>
        expect(confirmDialogMock).toHaveBeenCalledWith('purchaseOrders.receiveConfirm 2'),
      );
      expect(receiveMutate).not.toHaveBeenCalled();
      expect(toastMock.success).not.toHaveBeenCalled();
    });

    it('receives once confirmed and reports success', async () => {
      listOf(order());
      confirmDialogMock.mockResolvedValue(true);
      receiveMutate.mockResolvedValue(
        order({ status: 'RECEIVED', updatedAt: '2026-10-11T00:00:00.000Z' }),
      );
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.receiveStock' }));
      await waitFor(() => expect(receiveMutate).toHaveBeenCalledWith(1));
      await waitFor(() =>
        expect(toastMock.success).toHaveBeenCalledWith('purchaseOrders.receiveSuccess'),
      );
      // The open order flips to its returned state: no more receive button.
      await waitFor(() => expect(hasAction('receiveStock')).toBe(false));
    });

    it('surfaces a server refusal as an error toast (e.g. already received)', async () => {
      listOf(order());
      confirmDialogMock.mockResolvedValue(true);
      receiveMutate.mockRejectedValue({
        response: { data: { code: 'PURCHASE_ORDER_ALREADY_RECEIVED', message: 'x' } },
      });
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.receiveStock' }));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
      expect(toastMock.success).not.toHaveBeenCalled();
    });
  });

  describe('confirm / cancel / delete', () => {
    it('confirms a draft after asking', async () => {
      listOf(order({ status: 'DRAFT' }));
      confirmDialogMock.mockResolvedValue(true);
      confirmMutate.mockResolvedValue(
        order({ status: 'ORDERED', updatedAt: '2026-10-11T00:00:00.000Z' }),
      );
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.confirmOrder' }));
      await waitFor(() => expect(confirmMutate).toHaveBeenCalledWith(1));
      await waitFor(() =>
        expect(toastMock.success).toHaveBeenCalledWith('purchaseOrders.confirmSuccess'),
      );
    });

    it('cancels an order after asking', async () => {
      listOf(order());
      confirmDialogMock.mockResolvedValue(true);
      cancelMutate.mockResolvedValue(
        order({ status: 'CANCELLED', updatedAt: '2026-10-11T00:00:00.000Z' }),
      );
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.cancelOrder' }));
      await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith({ id: 1 }));
    });

    it('does not delete when the confirmation is declined', async () => {
      listOf(order({ status: 'DRAFT' }));
      confirmDialogMock.mockResolvedValue(false);
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.delete' }));
      await waitFor(() => expect(confirmDialogMock).toHaveBeenCalled());
      expect(deleteMutate).not.toHaveBeenCalled();
    });

    it('deletes a draft and closes the detail', async () => {
      listOf(order({ status: 'DRAFT' }));
      confirmDialogMock.mockResolvedValue(true);
      deleteMutate.mockResolvedValue({});
      renderPage();
      openDetail();
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.delete' }));
      await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });
});
