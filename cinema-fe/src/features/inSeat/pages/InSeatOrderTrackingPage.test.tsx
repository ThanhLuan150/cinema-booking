import '@/i18n';
import i18n from '@/i18n';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import type { InSeatOrder } from '../types/inSeat.types';

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));

const api = vi.hoisted(() => ({
  getInSeatSession: vi.fn(),
  createInSeatOrder: vi.fn(),
  confirmInSeatMomoPayment: vi.fn(),
  getInSeatOrder: vi.fn(),
  getMyInSeatOrders: vi.fn(),
  getSeatQrSheet: vi.fn(),
}));
vi.mock('../api/inSeat.api', () => api);

import InSeatOrderTrackingPage from './InSeatOrderTrackingPage';
import InSeatPaymentResultPage from './InSeatPaymentResultPage';

const assignMock = vi.fn();
const originalLocation = window.location;

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { accessToken: 'token', userId: '10', role: '1', account: null } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/InSeat/Orders/:code" element={<InSeatOrderTrackingPage />} />
            <Route path="/InSeat/PaymentResult" element={<InSeatPaymentResultPage />} />
            <Route path="/InSeat" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function order(overrides: Partial<InSeatOrder> = {}): InSeatOrder {
  return {
    id: 1,
    code: 'CO-1',
    status: 'PAID',
    items: [
      { combo_id: 1, name: 'Large Popcorn', unit_price: 65000, quantity: 2, line_total: 130000 },
      { combo_id: 2, name: 'Coke', unit_price: 30000, quantity: 1, line_total: 30000 },
    ],
    total_price: 160000,
    seat: { code: 'E7', room: 'Hall 3', showtime: { id: 7, date: '2026-10-03', time: '19:30' } },
    booking_id: 100,
    payment: { status: 'PAID', method: 'MOMO', amount: 160000 },
    pay_url: null,
    expires_at: null,
    created_at: '2026-10-03T12:00:00.000Z',
    paid_at: '2026-10-03T12:01:00.000Z',
    prepared_at: null,
    ready_at: null,
    delivered_at: null,
    cancelled_at: null,
    cancel_reason: null,
    ...overrides,
  };
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  Object.values(toastMock).forEach((fn) => fn.mockReset());
  assignMock.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignMock },
  });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  sessionStorage.clear();
});

describe('InSeatOrderTrackingPage', () => {
  it('follows the order from the kitchen to the seat', async () => {
    api.getInSeatOrder.mockResolvedValue(
      order({
        status: 'READY',
        prepared_at: '2026-10-03T12:05:00.000Z',
        ready_at: '2026-10-03T12:12:00.000Z',
      }),
    );
    renderAt('/InSeat/Orders/CO-1');

    expect(await screen.findByText('Order CO-1')).toBeInTheDocument();
    expect(api.getInSeatOrder).toHaveBeenCalledWith('CO-1');
    expect(screen.getByText('To seat E7 · Hall 3')).toBeInTheDocument();
    expect(
      screen.getByText('Your order is ready and on its way to your seat.'),
    ).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Order progress' });
    expect(within(progress).getAllByRole('listitem')).toHaveLength(4);
    expect(within(progress).getByText('Ready').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(screen.getByText(/160,000/)).toBeInTheDocument();
  });

  it('a cancelled paid order explains the refund', async () => {
    api.getInSeatOrder.mockResolvedValue(
      order({
        status: 'CANCELLED',
        cancel_reason: 'Popcorn machine down',
        payment: { status: 'REFUND_PENDING', method: 'MOMO', amount: 160000 },
      }),
    );
    renderAt('/InSeat/Orders/CO-1');
    expect(await screen.findByText('This order was cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Reason: Popcorn machine down')).toBeInTheDocument();
    expect(screen.getByText('Your payment will be refunded.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Order progress' })).not.toBeInTheDocument();
  });

  it('an unpaid order can be paid from here while its MoMo link is still valid', async () => {
    api.getInSeatOrder.mockResolvedValue(
      order({
        status: 'PENDING',
        paid_at: null,
        pay_url: 'https://pay.example/CO-1',
        payment: null,
      }),
    );
    renderAt('/InSeat/Orders/CO-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue payment' }));
    expect(assignMock).toHaveBeenCalledWith('https://pay.example/CO-1');
  });

  it('offers to order more to the same seat when it was scanned in this tab', async () => {
    sessionStorage.setItem('inSeat.lastQr', 'SQR1.a.b');
    api.getInSeatOrder.mockResolvedValue(
      order({ status: 'DELIVERED', delivered_at: '2026-10-03T12:20:00.000Z' }),
    );
    renderAt('/InSeat/Orders/CO-1');
    fireEvent.click(await screen.findByRole('button', { name: /Order more to this seat/ }));
    expect(screen.getByTestId('location').textContent).toBe('/InSeat?qr=SQR1.a.b');
  });

  it("says so when the order doesn't exist (or isn't the caller's)", async () => {
    api.getInSeatOrder.mockRejectedValue({
      response: { status: 404, data: { code: 'IN_SEAT_ORDER_NOT_FOUND' } },
    });
    renderAt('/InSeat/Orders/CO-999');
    expect(await screen.findByText("We couldn't find this order.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan a seat QR/ })).toBeInTheDocument();
  });
});

describe('InSeatPaymentResultPage', () => {
  it('hands MoMo’s signed result to the server once, then opens the live order page', async () => {
    api.confirmInSeatMomoPayment.mockResolvedValue({
      success: true,
      already_processed: false,
      refund_pending: false,
      order: order(),
    });
    api.getInSeatOrder.mockResolvedValue(order());
    renderAt('/InSeat/PaymentResult?orderId=CO-1&resultCode=0&transId=99&signature=abc');

    expect(await screen.findByText('Order CO-1')).toBeInTheDocument();
    expect(api.confirmInSeatMomoPayment).toHaveBeenCalledTimes(1);
    expect(api.confirmInSeatMomoPayment).toHaveBeenCalledWith('CO-1', {
      orderId: 'CO-1',
      resultCode: '0',
      transId: '99',
      signature: 'abc',
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('a failed payment still lands on the order page (now cancelled)', async () => {
    api.confirmInSeatMomoPayment.mockResolvedValue({
      success: false,
      already_processed: false,
      refund_pending: false,
      order: order({ status: 'CANCELLED', cancel_reason: 'Payment failed' }),
    });
    api.getInSeatOrder.mockResolvedValue(
      order({ status: 'CANCELLED', cancel_reason: 'Payment failed' }),
    );
    renderAt('/InSeat/PaymentResult?orderId=CO-1&resultCode=1006');
    expect(await screen.findByText('This order was cancelled.')).toBeInTheDocument();
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('shows the error when the result cannot be verified', async () => {
    api.confirmInSeatMomoPayment.mockRejectedValue({
      response: { status: 400, data: { code: 'PAYMENT_SIGNATURE_INVALID' } },
    });
    renderAt('/InSeat/PaymentResult?orderId=CO-1&resultCode=0');
    expect(await screen.findByText("The payment result couldn't be verified.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the order' })).toHaveAttribute(
      'href',
      '/InSeat/Orders/CO-1',
    );
  });

  it('needs a payment result to do anything', async () => {
    renderAt('/InSeat/PaymentResult');
    expect(screen.getByText('This page needs a payment result from MoMo.')).toBeInTheDocument();
    await waitFor(() => expect(api.confirmInSeatMomoPayment).not.toHaveBeenCalled());
  });
});
