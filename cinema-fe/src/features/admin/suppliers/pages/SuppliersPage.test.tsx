import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
let grantedPermissions: Set<string> | null = null;
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (code: string) => grantedPermissions === null || grantedPermissions.has(code),
  }),
}));

const useSuppliersMock = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('../hooks/useSuppliers', () => ({
  useSuppliers: (...args: unknown[]) => useSuppliersMock(...args),
  useCreateSupplier: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateSupplier: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteSupplier: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));
const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({
  confirmDialog: (...args: unknown[]) => confirmDialogMock(...args),
}));

import SuppliersPage from './SuppliersPage';

const suppliers = [
  {
    id: 1,
    name: 'Acme Foods',
    code: 'ACME',
    email: 'sales@acme.test',
    phone: '0901',
    address: '1 Main St',
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'Dormant Co',
    code: 'DORM',
    email: '',
    phone: '',
    address: '',
    status: 'INACTIVE',
  },
];

function renderPage() {
  const store = configureStore({ reducer: { auth: (s = {}) => s } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SuppliersPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('SuppliersPage', () => {
  beforeEach(() => {
    grantedPermissions = null;
    [useSuppliersMock, createMutate, updateMutate, deleteMutate, confirmDialogMock].forEach((m) =>
      m.mockReset(),
    );
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    useSuppliersMock.mockReturnValue({
      data: { data: suppliers, totalPages: 1 },
      isLoading: false,
    });
  });

  it('lists suppliers with their status', () => {
    renderPage();
    expect(screen.getByText('Acme Foods')).toBeInTheDocument();
    expect(screen.getByText('Dormant Co')).toBeInTheDocument();
    expect(screen.getByText('suppliers.status.ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('suppliers.status.INACTIVE')).toBeInTheDocument();
  });

  it('gives a read-only viewer (a Branch Admin) no way to add, edit or delete', () => {
    grantedPermissions = new Set(['supplier.read']);
    renderPage();
    expect(screen.queryByRole('button', { name: 'suppliers.addButton' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'suppliers.edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'suppliers.delete' })).toBeNull();
  });

  it('shows the empty state', () => {
    useSuppliersMock.mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('suppliers.empty')).toBeInTheDocument();
  });

  it('will not create a supplier without a name and code', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.addButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.save' }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('suppliers.validation.required'),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('creates a supplier, upper-casing the code as it is typed', async () => {
    createMutate.mockResolvedValue({ id: 3 });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.addButton' }));
    fireEvent.change(screen.getByLabelText('suppliers.fields.name'), {
      target: { value: 'Gamma Ltd' },
    });
    fireEvent.change(screen.getByLabelText('suppliers.fields.code'), {
      target: { value: 'gamma' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.save' }));
    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Gamma Ltd', code: 'GAMMA', status: 'ACTIVE' }),
      ),
    );
    expect(toastMock.success).toHaveBeenCalledWith('suppliers.createSuccess');
  });

  it('reports the server refusing a duplicate code', async () => {
    createMutate.mockRejectedValue({
      response: { data: { code: 'SUPPLIER_CODE_TAKEN', message: 'taken' } },
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.addButton' }));
    fireEvent.change(screen.getByLabelText('suppliers.fields.name'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('suppliers.fields.code'), { target: { value: 'ACME' } });
    fireEvent.click(screen.getByRole('button', { name: 'suppliers.save' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    confirmDialogMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    deleteMutate.mockResolvedValue({});
    renderPage();
    const [firstDelete] = screen.getAllByRole('button', { name: 'suppliers.delete' });
    fireEvent.click(firstDelete);
    await waitFor(() => expect(confirmDialogMock).toHaveBeenCalledTimes(1));
    expect(deleteMutate).not.toHaveBeenCalled();
    fireEvent.click(firstDelete);
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
  });

  it('shows the API error when a supplier in use cannot be deleted', async () => {
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockRejectedValue({
      response: { data: { code: 'SUPPLIER_IN_USE', message: 'in use' } },
    });
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'suppliers.delete' })[0]);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
