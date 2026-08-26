import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerPromotionsReducer from '../../store/ownerPromotionsSlice';

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
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => undefined }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

const useOwnerCombosMock = vi.fn();
vi.mock('../../hooks/useOwnerCombos', () => ({ useOwnerCombos: (...args: unknown[]) => useOwnerCombosMock(...args) }));

const useOwnerPromotionsMock = vi.fn();
vi.mock('../../hooks/useOwnerPromotions', () => ({
  useOwnerPromotions: (...args: unknown[]) => useOwnerPromotionsMock(...args),
}));

const createPromotionMutate = vi.fn();
const updatePromotionMutate = vi.fn();
const deletePromotionMutate = vi.fn();
vi.mock('../../hooks/usePromotionMutations', () => ({
  useCreatePromotion: () => ({ mutateAsync: createPromotionMutate, isPending: false }),
  useUpdatePromotion: () => ({ mutateAsync: updatePromotionMutate, isPending: false }),
  useDeletePromotion: () => ({ mutateAsync: deletePromotionMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import PromotionList from './List';

function basePromotion(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'SUMMER10',
    name: 'Summer Sale',
    description: '',
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    minimum_order_value: 0,
    maximum_discount: null,
    start_at: '2026-01-01T00:00:00.000Z',
    end_at: '2026-02-01T00:00:00.000Z',
    usage_limit: null,
    used_count: 3,
    per_customer_limit: null,
    status: 'ACTIVE',
    branch_ids: [1],
    movie_ids: [],
    showtime_ids: [],
    combo_ids: [],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerPromotions: ownerPromotionsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PromotionList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Promotions List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useMoviesMock.mockReset();
    useOwnerCombosMock.mockReset();
    useOwnerPromotionsMock.mockReset();
    createPromotionMutate.mockReset();
    updatePromotionMutate.mockReset();
    deletePromotionMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 5, name: 'Inception' }] } });
    useOwnerCombosMock.mockReturnValue({ data: { data: [{ id: 9, name: 'Combo Big' }] } });
  });

  it('renders promotion rows with scope, discount, usage and status', () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [basePromotion()], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('SUMMER10')).toBeInTheDocument();
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('promotions.statusActive')).toBeInTheDocument();
  });

  it('shows "All branches" scope for a system-wide promotion', () => {
    useOwnerPromotionsMock.mockReturnValue({
      data: { data: [basePromotion({ branch_ids: [] })], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('promotions.allBranchesOption')).toBeInTheDocument();
  });

  it('shows the eligible movie and combo names when scoped', () => {
    useOwnerPromotionsMock.mockReturnValue({
      data: { data: [basePromotion({ movie_ids: [5], combo_ids: [9] })], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Cinema A · Inception · Combo Big')).toBeInTheDocument();
  });

  it('toggles a promotion active state', async () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [basePromotion()], totalPages: 1 } });
    updatePromotionMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('promotions.deactivate'));
    await waitFor(() => expect(updatePromotionMutate).toHaveBeenCalledWith({ id: 1, status: 'INACTIVE' }));
  });

  it('deletes a promotion after confirming', async () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [basePromotion()], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    deletePromotionMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('promotions.delete'));
    await waitFor(() => expect(deletePromotionMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-promotion modal from the add button', () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('promotions.addButton'));
    expect(screen.getByText('promotions.addTitle')).toBeInTheDocument();
  });

  function pickFirstOfMonthFromCalendar(label: string, monthsAhead: number) {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1);
    fireEvent.click(screen.getByLabelText(label));
    for (let i = 0; i < monthsAhead; i += 1) {
      fireEvent.click(screen.getByLabelText('Next month'));
    }
    fireEvent.click(screen.getByRole('gridcell', { name: '1' }));
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  it('creates a promotion scoped to a branch with the backend-required fields', async () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createPromotionMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('promotions.addButton'));

    fireEvent.change(document.querySelector('input[name="code"]')!, { target: { value: 'newpromo' } });
    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'New Promo' } });
    fireEvent.change(document.querySelector('input[name="discount_value"]')!, { target: { value: '20' } });

    const startAt = pickFirstOfMonthFromCalendar('promotions.startAtLabel', 1);
    const endAt = pickFirstOfMonthFromCalendar('promotions.endAtLabel', 2);

    fireEvent.click(screen.getByText('promotions.submit'));

    await waitFor(() => expect(createPromotionMutate).toHaveBeenCalled());
    expect(createPromotionMutate.mock.calls[0][0]).toMatchObject({
      code: 'NEWPROMO',
      name: 'New Promo',
      discount_type: 'PERCENTAGE',
      discount_value: 20,
      start_at: startAt,
      end_at: endAt,
      branch_ids: [1],
      movie_ids: [],
      combo_ids: [],
    });
  });

  it('opens the edit-promotion modal for a specific promotion', () => {
    useOwnerPromotionsMock.mockReturnValue({ data: { data: [basePromotion()], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('promotions.edit'));
    expect(screen.getByText('promotions.editTitle')).toBeInTheDocument();
  });
});
