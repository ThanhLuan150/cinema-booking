import '@/i18n';
import i18n from '@/i18n';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: () => Promise.resolve(true) }));

const NO_BENEFITS = {
  ticket_discount_percent: 0,
  fnb_discount_percent: 0,
  free_tickets: 0,
  free_ticket_max_value: null,
  priority_booking_hours: 0,
  points_multiplier: 1,
};

vi.mock('@/features/membership/hooks/useMembershipLevels', () => ({
  useMembershipLevels: () => ({
    data: [{ id: 3, code: 'GOLD', name: 'Gold', min_points: 5000000, active: true, benefits: { ...NO_BENEFITS, ticket_discount_percent: 10 } }],
    isLoading: false,
  }),
}));

const updateTierMock = vi.fn();
const savePlanMock = vi.fn();
const revokeMock = vi.fn();
vi.mock('@/features/membership/hooks/useSubscriptions', () => ({
  useUpdateTierBenefits: () => ({ mutateAsync: updateTierMock, isPending: false }),
  useAllSubscriptionPlans: () => ({
    data: [
      {
        id: 1,
        code: 'MONTHLY_PASS',
        name: 'Monthly Cinema Pass',
        description: '',
        price: 199000,
        duration_days: 30,
        benefits: { ...NO_BENEFITS, free_tickets: 4 },
        active: true,
        sort_order: 1,
      },
    ],
    isLoading: false,
  }),
  useSaveSubscriptionPlan: () => ({ mutateAsync: savePlanMock, isPending: false }),
  useDeleteSubscriptionPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAllSubscriptions: () => ({
    data: {
      data: [
        {
          id: 5,
          code: 'SUB-5',
          account_id: 10,
          plan: { name: 'Monthly Cinema Pass', benefits: { ...NO_BENEFITS, free_tickets: 4 } },
          status: 'ACTIVE',
          start_at: '2026-10-20T00:00:00.000Z',
          end_at: '2026-11-19T00:00:00.000Z',
          tickets_used: 1,
        },
      ],
      total: 1,
      totalPages: 1,
    },
  }),
  useRevokeSubscription: () => ({ mutateAsync: revokeMock, isPending: false }),
}));

import MembershipAdminPage from './MembershipAdminPage';

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MembershipAdminPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('MembershipAdminPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    updateTierMock.mockReset();
    savePlanMock.mockReset();
    revokeMock.mockReset();
  });

  it("saves a tier's threshold and benefits as numbers", async () => {
    updateTierMock.mockResolvedValue({});
    renderPage();
    const gold = screen.getByTestId('tier-GOLD');
    fireEvent.change(within(gold).getByLabelText('Free tickets / month'), { target: { value: '2' } });
    fireEvent.change(within(gold).getByLabelText('Max value per free ticket (empty = whole seat)'), { target: { value: '90000' } });
    fireEvent.click(within(gold).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateTierMock).toHaveBeenCalledWith({
        id: 3,
        min_points: 5000000,
        benefits: { ...NO_BENEFITS, ticket_discount_percent: 10, free_tickets: 2, free_ticket_max_value: 90000 },
      }),
    );
  });

  it('creates a plan from the form', async () => {
    savePlanMock.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscription plans' }));
    expect(screen.getByText('Monthly Cinema Pass')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'yearly' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Yearly Pass' } });
    fireEvent.change(screen.getByLabelText('Price (VND)'), { target: { value: '1990000' } });
    fireEvent.change(screen.getByLabelText('Term (days)'), { target: { value: '365' } });
    fireEvent.change(screen.getByLabelText('Free tickets / term'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    await waitFor(() => expect(savePlanMock).toHaveBeenCalled());
    expect(savePlanMock.mock.calls[0][0]).toMatchObject({
      id: null,
      payload: { code: 'YEARLY', name: 'Yearly Pass', price: 1990000, duration_days: 365, active: true, benefits: { free_tickets: 40 } },
    });
  });

  it('revokes a customer subscription', async () => {
    revokeMock.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Subscriptions' }));
    expect(screen.getByText('SUB-5')).toBeInTheDocument();
    expect(screen.getByText('1/4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith({ id: 5 }));
  });
});
