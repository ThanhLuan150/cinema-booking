import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerVouchersReducer from '../../store/ownerVouchersSlice';

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

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));

const useOwnerVouchersMock = vi.fn();
vi.mock('../../hooks/useOwnerVouchers', () => ({
  useOwnerVouchers: (...args: unknown[]) => useOwnerVouchersMock(...args),
}));

const createVoucherMutate = vi.fn();
const updateVoucherMutate = vi.fn();
const deleteVoucherMutate = vi.fn();
vi.mock('../../hooks/useVoucherMutations', () => ({
  useCreateVoucher: () => ({ mutateAsync: createVoucherMutate, isPending: false }),
  useUpdateVoucher: () => ({ mutateAsync: updateVoucherMutate }),
  useDeleteVoucher: () => ({ mutateAsync: deleteVoucherMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import VoucherList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerVouchers: ownerVouchersReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <VoucherList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Vouchers List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useOwnerVouchersMock.mockReset();
    createVoucherMutate.mockReset();
    updateVoucherMutate.mockReset();
    deleteVoucherMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders voucher rows with cinema name, discount and status', () => {
    useOwnerVouchersMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            cinema_id: 1,
            code: 'SUMMER10',
            discount_type: 'percent',
            discount_value: 10,
            used_count: 2,
            max_uses: 100,
            active: true,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('SUMMER10')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('vouchers.statusActive')).toBeInTheDocument();
  });

  it('toggles a voucher active state', async () => {
    useOwnerVouchersMock.mockReturnValue({
      data: {
        data: [{ id: 1, cinema_id: 1, code: 'A', discount_type: 'percent', discount_value: 10, used_count: 0, max_uses: null, active: true }],
        totalPages: 1,
      },
    });
    updateVoucherMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('vouchers.deactivate'));
    await waitFor(() => expect(updateVoucherMutate).toHaveBeenCalledWith({ id: 1, active: false }));
  });

  it('deletes a voucher after confirming', async () => {
    useOwnerVouchersMock.mockReturnValue({
      data: {
        data: [{ id: 1, cinema_id: 1, code: 'A', discount_type: 'percent', discount_value: 10, used_count: 0, max_uses: null, active: false }],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteVoucherMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('vouchers.delete'));
    await waitFor(() => expect(deleteVoucherMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-voucher modal from the add button', () => {
    useOwnerVouchersMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('vouchers.addButton'));
    expect(screen.getByText('vouchers.addTitle')).toBeInTheDocument();
  });
});
