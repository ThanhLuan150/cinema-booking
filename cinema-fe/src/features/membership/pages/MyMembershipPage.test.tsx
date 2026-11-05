import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyMembershipMock = vi.fn();
vi.mock('../hooks/useMyMembership', () => ({ useMyMembership: () => useMyMembershipMock() }));

const useMyPointsHistoryMock = vi.fn();
vi.mock('../hooks/useMyPointsHistory', () => ({ useMyPointsHistory: (...args: unknown[]) => useMyPointsHistoryMock(...args) }));

const redeemMutateAsyncMock = vi.fn();
vi.mock('../hooks/useRedeemPoints', () => ({
  useRedeemPoints: () => ({ mutateAsync: redeemMutateAsyncMock, isPending: false }),
}));

const useMembershipDetailsMock = vi.fn();
const useSubscriptionPlansMock = vi.fn();
const purchaseMock = vi.fn();
const cancelMock = vi.fn();
vi.mock('../hooks/useSubscriptions', () => ({
  useMembershipDetails: () => useMembershipDetailsMock(),
  useSubscriptionPlans: () => useSubscriptionPlansMock(),
  useMySubscriptions: () => ({ data: { data: [], total: 0, totalPages: 1 } }),
  usePurchaseSubscription: () => ({ mutateAsync: purchaseMock, isPending: false }),
  useCancelMySubscription: () => ({ mutateAsync: cancelMock, isPending: false }),
}));

import MyMembershipPage from './MyMembershipPage';

const NO_BENEFITS = {
  ticket_discount_percent: 0,
  fnb_discount_percent: 0,
  free_tickets: 0,
  free_ticket_max_value: null,
  priority_booking_hours: 0,
  points_multiplier: 1,
};
const PASS_BENEFITS = { ...NO_BENEFITS, free_tickets: 4, fnb_discount_percent: 10 };
const PLAN = {
  id: 1,
  code: 'MONTHLY_PASS',
  name: 'Monthly Cinema Pass',
  description: '4 tickets every month',
  price: 199000,
  duration_days: 30,
  benefits: PASS_BENEFITS,
  active: true,
  sort_order: 1,
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    code: 'SUB-5',
    account_id: 1,
    plan_id: 1,
    plan: { code: 'MONTHLY_PASS', name: 'Monthly Cinema Pass', price: 199000, duration_days: 30, benefits: PASS_BENEFITS },
    price: 199000,
    status: 'ACTIVE',
    start_at: '2026-10-20T00:00:00.000Z',
    end_at: '2026-11-19T00:00:00.000Z',
    tickets_used: 1,
    tickets_remaining: 3,
    payment_expires_at: null,
    paid_at: '2026-10-20T00:00:00.000Z',
    cancelled_at: null,
    cancel_reason: null,
    createdAt: '2026-10-20T00:00:00.000Z',
    pay_url: null,
    ...overrides,
  };
}

function details(overrides: Record<string, unknown> = {}) {
  return {
    level: { code: 'GOLD', name: 'Gold', min_points: 5000000, benefits: { ...NO_BENEFITS, ticket_discount_percent: 10, priority_booking_hours: 12 } },
    next_level: { code: 'PLATINUM', name: 'Platinum', min_points: 15000000, benefits: { ...NO_BENEFITS, free_tickets: 1 } },
    points_balance: 400,
    lifetime_points: 1200,
    points_to_next_level: 100,
    subscription: null,
    pending_subscription: null,
    effective_benefits: { ticket_discount_percent: 10, fnb_discount_percent: 0, priority_booking_hours: 12, points_multiplier: 1 },
    free_tickets: { tier: null, subscription: null, remaining_total: 0 },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyMembershipPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    membership_level: 'SILVER',
    membership_level_name: 'Silver',
    points_balance: 400,
    lifetime_points: 1200,
    next_level: { code: 'GOLD', name: 'Gold', min_points: 5000000 },
    points_to_next_level: 4998800,
    ...overrides,
  };
}

describe('MyMembershipPage', () => {
  beforeEach(() => {
    useMyMembershipMock.mockReset();
    useMyPointsHistoryMock.mockReset();
    redeemMutateAsyncMock.mockReset();
    useMembershipDetailsMock.mockReset();
    useMembershipDetailsMock.mockReturnValue({ data: undefined });
    useSubscriptionPlansMock.mockReset();
    useSubscriptionPlansMock.mockReturnValue({ data: [PLAN], isLoading: false });
    purchaseMock.mockReset();
    cancelMock.mockReset();
  });

  const withSummary = () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
  };

  it("shows the tier's benefits and what the next tier adds", () => {
    withSummary();
    useMembershipDetailsMock.mockReturnValue({ data: details() });
    renderPage();
    expect(screen.getByText('Gold benefits')).toBeInTheDocument();
    expect(screen.getByText('10% off tickets')).toBeInTheDocument();
    expect(screen.getByText('Book up to 12 hours before general sale')).toBeInTheDocument();
    expect(screen.getByText('Reach Platinum to get')).toBeInTheDocument();
    expect(screen.getByText('1 free ticket a month')).toBeInTheDocument();
  });

  it('shows the active subscription, its term and its free tickets, and does not offer a second one', () => {
    withSummary();
    useMembershipDetailsMock.mockReturnValue({
      data: details({
        subscription: subscription(),
        free_tickets: { tier: null, subscription: { limit: 4, used: 1, remaining: 3, ends_at: '2026-11-19T00:00:00.000Z' }, remaining_total: 3 },
      }),
    });
    renderPage();
    const active = screen.getByTestId('active-subscription');
    expect(active).toHaveTextContent('Monthly Cinema Pass');
    expect(active).toHaveTextContent('1 of 4 tickets used');
    expect(screen.getByTestId('free-tickets-remaining')).toHaveTextContent('3');
    expect(screen.getByText('3 of 4 left on your subscription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy with MoMo' })).toBeDisabled();
  });

  it('lets the customer continue paying for, or cancel, a pending purchase', async () => {
    withSummary();
    cancelMock.mockResolvedValue({});
    useMembershipDetailsMock.mockReturnValue({
      data: details({ pending_subscription: subscription({ status: 'PENDING_PAYMENT', start_at: null, end_at: null, pay_url: 'https://momo.test/pay' }) }),
    });
    renderPage();
    expect(screen.getByTestId('pending-subscription')).toHaveTextContent('Waiting for payment');
    fireEvent.click(screen.getByRole('button', { name: 'Continue payment' }));
    expect(await screen.findByText('Choose how to pay with MoMo')).toBeInTheDocument();
  });

  it('buys a plan and opens the MoMo payment', async () => {
    withSummary();
    useMembershipDetailsMock.mockReturnValue({ data: details() });
    purchaseMock.mockResolvedValue({ subscription: subscription({ status: 'PENDING_PAYMENT' }), pay_url: 'https://momo.test/pay', replayed: false });
    renderPage();
    expect(screen.getByText('4 free tickets per term')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buy with MoMo' }));
    await waitFor(() => expect(purchaseMock).toHaveBeenCalledWith({ planId: 1, idempotencyKey: expect.any(String) }));
    expect(await screen.findByText('Choose how to pay with MoMo')).toBeInTheDocument();
  });

  it('shows the current tier and points balance', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  it('shows the top-tier message when there is no next level', () => {
    useMyMembershipMock.mockReturnValue({
      data: summary({ next_level: null, points_to_next_level: 0, membership_level: 'PLATINUM', membership_level_name: 'Platinum' }),
      isLoading: false,
    });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/highest membership tier/i)).toBeInTheDocument();
  });

  it('shows an empty state when there is no points history', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByText(/no points activity/i)).toBeInTheDocument();
  });

  it('renders a points transaction row with its type and signed amount', () => {
    useMyMembershipMock.mockReturnValue({ data: summary(), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            type: 'EARN',
            points: 10,
            description: 'Booking BK-1',
            createdAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        total: 1,
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Earned')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('Booking BK-1')).toBeInTheDocument();
  });

  it('disables the redeem button when the balance is 0', () => {
    useMyMembershipMock.mockReturnValue({ data: summary({ points_balance: 0 }), isLoading: false });
    useMyPointsHistoryMock.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false });
    renderPage();
    expect(screen.getByRole('button', { name: /redeem points/i })).toBeDisabled();
  });
});
