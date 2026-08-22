import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerPricingRulesReducer from '../../store/ownerPricingRulesSlice';

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

const useCategoriesMock = vi.fn();
vi.mock('@/features/movies/hooks/useCategories', () => ({ useCategories: (...args: unknown[]) => useCategoriesMock(...args) }));

const useOwnerPricingRulesMock = vi.fn();
vi.mock('../../hooks/useOwnerPricingRules', () => ({
  useOwnerPricingRules: (...args: unknown[]) => useOwnerPricingRulesMock(...args),
}));

const createPricingRuleMutate = vi.fn();
const updatePricingRuleMutate = vi.fn();
const deletePricingRuleMutate = vi.fn();
vi.mock('../../hooks/usePricingRuleMutations', () => ({
  useCreatePricingRule: () => ({ mutateAsync: createPricingRuleMutate, isPending: false }),
  useUpdatePricingRule: () => ({ mutateAsync: updatePricingRuleMutate, isPending: false }),
  useDeletePricingRule: () => ({ mutateAsync: deletePricingRuleMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import PricingRuleList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerPricingRules: ownerPricingRulesReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PricingRuleList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Pricing Rules List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useCategoriesMock.mockReset();
    useOwnerPricingRulesMock.mockReset();
    createPricingRuleMutate.mockReset();
    updatePricingRuleMutate.mockReset();
    deletePricingRuleMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useCategoriesMock.mockReturnValue({ data: [{ id: 5, name: 'Horror' }] });
  });

  it('renders rule rows with branch, match summary, price and status', () => {
    useOwnerPricingRulesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: '2D Weekday',
            price: 80000,
            priority: 0,
            active: true,
            effective_from: null,
            effective_to: null,
            branch_id: 1,
            room_type: '2D',
            seat_type: 0,
            category_id: null,
            day_type: 'WEEKDAY',
            time_start: null,
            time_end: null,
            membership_level: null,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('2D Weekday')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('80,000đ')).toBeInTheDocument();
    expect(screen.getByText('pricingRules.statusActive')).toBeInTheDocument();
    expect(
      screen.getByText('2D · pricingRules.seatTypeLabels.standard · pricingRules.dayTypeLabels.WEEKDAY'),
    ).toBeInTheDocument();
  });

  it('shows "Any" for a fully wildcard rule with no branch scope', () => {
    useOwnerPricingRulesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'Global default',
            price: 90000,
            priority: 0,
            active: true,
            effective_from: null,
            effective_to: null,
            branch_id: null,
            room_type: null,
            seat_type: null,
            category_id: null,
            day_type: null,
            time_start: null,
            time_end: null,
            membership_level: null,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('pricingRules.allBranchesOption')).toBeInTheDocument();
    expect(screen.getByText('pricingRules.matchAny')).toBeInTheDocument();
  });

  it('toggles a rule active state', async () => {
    useOwnerPricingRulesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'A',
            price: 1,
            priority: 0,
            active: true,
            effective_from: null,
            effective_to: null,
            branch_id: 1,
            room_type: null,
            seat_type: null,
            category_id: null,
            day_type: null,
            time_start: null,
            time_end: null,
            membership_level: null,
          },
        ],
        totalPages: 1,
      },
    });
    updatePricingRuleMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.deactivate'));
    await waitFor(() => expect(updatePricingRuleMutate).toHaveBeenCalledWith({ id: 1, active: false }));
  });

  it('deletes a rule after confirming', async () => {
    useOwnerPricingRulesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'A',
            price: 1,
            priority: 0,
            active: false,
            effective_from: null,
            effective_to: null,
            branch_id: 1,
            room_type: null,
            seat_type: null,
            category_id: null,
            day_type: null,
            time_start: null,
            time_end: null,
            membership_level: null,
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deletePricingRuleMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.delete'));
    await waitFor(() => expect(deletePricingRuleMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-rule modal from the add button', () => {
    useOwnerPricingRulesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.addButton'));
    expect(screen.getByText('pricingRules.addTitle')).toBeInTheDocument();
  });

  // The effective-date fields use the shared DateInput calendar picker (not a native
  // <input type="date">). DateInput has no value to seed the calendar with in the empty Add
  // form, so it opens on the real current month; picking "1" from the following month keeps
  // the target date deterministic without depending on which day the suite happens to run on.
  function pickNextMonthFirstFromCalendar(label: string) {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    fireEvent.click(screen.getByLabelText(label));
    fireEvent.click(screen.getByLabelText('Next month'));
    fireEvent.click(screen.getByRole('gridcell', { name: '1' }));
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  it('fills the effective-from date via the DateInput picker and creates the rule with it', async () => {
    useOwnerPricingRulesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createPricingRuleMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.addButton'));

    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Weekend Promo' } });
    fireEvent.change(document.querySelector('input[name="price"]')!, { target: { value: '90000' } });
    const expectedDate = pickNextMonthFirstFromCalendar('pricingRules.effectiveFromLabel');

    fireEvent.click(screen.getByText('pricingRules.submit'));

    await waitFor(() => expect(createPricingRuleMutate).toHaveBeenCalled());
    expect(createPricingRuleMutate.mock.calls[0][0]).toMatchObject({
      name: 'Weekend Promo',
      price: 90000,
      effective_from: expectedDate,
      effective_to: null,
    });
  });

  it('fills the showtime window via the TimeInput pickers and creates the rule with it', async () => {
    useOwnerPricingRulesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createPricingRuleMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.addButton'));

    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Evening Show' } });
    fireEvent.change(document.querySelector('input[name="price"]')!, { target: { value: '120000' } });

    fireEvent.click(screen.getByLabelText('pricingRules.timeStartLabel'));
    fireEvent.click(screen.getByRole('option', { name: '18:00' }));
    fireEvent.click(screen.getByLabelText('pricingRules.timeEndLabel'));
    fireEvent.click(screen.getByRole('option', { name: '23:00' }));

    fireEvent.click(screen.getByText('pricingRules.submit'));

    await waitFor(() => expect(createPricingRuleMutate).toHaveBeenCalled());
    expect(createPricingRuleMutate.mock.calls[0][0]).toMatchObject({
      name: 'Evening Show',
      price: 120000,
      time_start: '18:00',
      time_end: '23:00',
    });
  });

  it('opens the edit-rule modal for a specific rule', () => {
    useOwnerPricingRulesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            name: 'A',
            price: 1,
            priority: 0,
            active: true,
            effective_from: null,
            effective_to: null,
            branch_id: 1,
            room_type: null,
            seat_type: null,
            category_id: null,
            day_type: null,
            time_start: null,
            time_end: null,
            membership_level: null,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    fireEvent.click(screen.getByText('pricingRules.edit'));
    expect(screen.getByText('pricingRules.editTitle')).toBeInTheDocument();
  });
});
