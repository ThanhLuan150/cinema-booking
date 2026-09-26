import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { PurchaseOrder } from '@/types/entities';

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

vi.mock('@/features/admin/suppliers/hooks/useSuppliers', () => ({
  useAllSuppliers: () => ({
    data: [
      { id: 2, name: 'Acme Foods', code: 'ACME', status: 'ACTIVE' },
      { id: 3, name: 'Beta Drinks', code: 'BETA', status: 'ACTIVE' },
    ],
  }),
}));

const products = [
  { id: 1, branch_id: 1, item: 'Popcorn', sku: 'POP', unit: 'kg', cost_price: 100 },
  { id: 2, branch_id: 1, item: 'Cola', sku: null, unit: 'can', cost_price: 20 },
];
const useBranchProductsMock = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
vi.mock('../hooks/usePurchaseOrders', () => ({
  useBranchProducts: (...args: unknown[]) => useBranchProductsMock(...args),
  useCreatePurchaseOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdatePurchaseOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));

import { PurchaseOrderFormModal } from './PurchaseOrderFormModal';

const cinemas = [{ id: 1, name: 'Cinema A' }];

const pick = (control: HTMLElement, optionText: string | RegExp) => {
  fireEvent.click(control);
  fireEvent.click(within(screen.getByRole('listbox')).getByText(optionText));
};

describe('PurchaseOrderFormModal', () => {
  beforeEach(() => {
    [useBranchProductsMock, createMutate, updateMutate].forEach((m) => m.mockReset());
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    useBranchProductsMock.mockReturnValue({ data: products });
  });

  it('preselects the branch when there is only one, and loads its products', () => {
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={vi.fn()} />);
    expect(useBranchProductsMock).toHaveBeenCalledWith('1');
    expect(screen.getByLabelText('purchaseOrders.fields.branch')).toHaveTextContent('Cinema A');
  });

  it('does not submit without a supplier, and shows why', async () => {
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.saveDraft' }));
    expect(
      await screen.findByText('purchaseOrders.validation.supplierRequired'),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('does not submit a line with a product but no quantity', async () => {
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={vi.fn()} />);
    pick(screen.getByLabelText('purchaseOrders.fields.supplier'), /Acme Foods/);
    pick(screen.getByLabelText('purchaseOrders.fields.product'), /Popcorn/);
    fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.saveDraft' }));
    expect(await screen.findByText('purchaseOrders.validation.lineInvalid')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('creates a draft with the typed lines, leaving a blank unit cost for the server to default', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    createMutate.mockResolvedValue({ id: 9 });
    render(
      <PurchaseOrderFormModal
        editing={null}
        cinemas={cinemas}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    pick(screen.getByLabelText('purchaseOrders.fields.supplier'), /Acme Foods/);
    pick(screen.getByLabelText('purchaseOrders.fields.product'), /Popcorn/);
    fireEvent.change(screen.getByLabelText('purchaseOrders.fields.quantity'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.saveDraft' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const payload = createMutate.mock.calls[0][0];
    expect(payload).toMatchObject({
      branch_id: 1,
      supplier_id: 2,
      items: [{ inventory_id: 1, quantity: 5 }],
      expected_date: null,
    });
    expect(payload.items[0]).not.toHaveProperty('unit_cost');
    expect(payload).not.toHaveProperty('total_amount');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalledWith({ id: 9 });
    expect(toastMock.success).toHaveBeenCalledWith('purchaseOrders.createSuccess');
  });

  it('previews the total from the product cost price until a cost is typed', () => {
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={vi.fn()} />);
    pick(screen.getByLabelText('purchaseOrders.fields.product'), /Popcorn/);
    fireEvent.change(screen.getByLabelText('purchaseOrders.fields.quantity'), {
      target: { value: '3' },
    });
    // 3 kg * 100 = 300 (shown twice: the line and the order total)
    expect(screen.getAllByText(/300/).length).toBeGreaterThanOrEqual(2);
    fireEvent.change(screen.getByLabelText('purchaseOrders.fields.unitCost'), {
      target: { value: '10' },
    });
    expect(screen.queryAllByText(/300/)).toHaveLength(0);
    expect(screen.getAllByText(/30/).length).toBeGreaterThanOrEqual(2);
  });

  it('does not offer a product that is already on another line', () => {
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={vi.fn()} />);
    pick(screen.getByLabelText('purchaseOrders.fields.product'), /Popcorn/);
    fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.addLine' }));
    const secondLine = screen.getAllByLabelText('purchaseOrders.fields.product')[1];
    fireEvent.click(secondLine);
    const options = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options.some((text) => text?.includes('Popcorn'))).toBe(false);
    expect(options.some((text) => text?.includes('Cola'))).toBe(true);
  });

  it('surfaces a server rejection as a toast and keeps the form open', async () => {
    const onClose = vi.fn();
    createMutate.mockRejectedValue({
      response: { data: { code: 'SUPPLIER_INACTIVE', message: 'inactive' } },
    });
    render(<PurchaseOrderFormModal editing={null} cinemas={cinemas} onClose={onClose} />);
    pick(screen.getByLabelText('purchaseOrders.fields.supplier'), /Acme Foods/);
    fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.saveDraft' }));
    // no lines given -> still valid as an empty draft
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('editing a draft', () => {
    const draft = {
      id: 4,
      code: 'PO-000004',
      supplier_id: 2,
      supplier: { id: 2, name: 'Acme Foods', code: 'ACME', status: 'ACTIVE' },
      branch_id: 1,
      order_date: '2026-10-10T00:00:00.000Z',
      expected_date: null,
      status: 'DRAFT',
      total_amount: 500,
      items: [
        {
          inventory_id: 1,
          item: 'Popcorn',
          sku: 'POP',
          unit: 'kg',
          quantity: 5,
          unit_cost: 100,
          line_total: 500,
        },
      ],
      note: '',
    } as unknown as PurchaseOrder;

    it('prefills the order, locks the branch, and saves without sending a branch', async () => {
      updateMutate.mockResolvedValue(draft);
      render(<PurchaseOrderFormModal editing={draft} cinemas={cinemas} onClose={vi.fn()} />);
      expect(screen.getByLabelText('purchaseOrders.fields.branch')).toBeDisabled();
      expect(screen.getByLabelText('purchaseOrders.fields.quantity')).toHaveValue(5);

      fireEvent.change(screen.getByLabelText('purchaseOrders.fields.quantity'), {
        target: { value: '8' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'purchaseOrders.saveDraft' }));

      await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
      const payload = updateMutate.mock.calls[0][0];
      expect(payload).toMatchObject({
        id: 4,
        supplier_id: 2,
        items: [{ inventory_id: 1, quantity: 8, unit_cost: 100 }],
      });
      expect(payload).not.toHaveProperty('branch_id');
      expect(createMutate).not.toHaveBeenCalled();
    });
  });
});
