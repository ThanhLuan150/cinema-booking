import '@/i18n';
import i18n from '@/i18n';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import type { InSeatSession } from '../types/inSeat.types';

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));
// The camera itself is out of scope here: a stub that "scans" a fixed text on click.
const scannedText = vi.hoisted(() => ({ value: '' }));
vi.mock('@/features/employee/components/QrScanner', () => ({
  QrScanner: ({ active, onScan }: { active: boolean; onScan: (data: string) => void }) =>
    active ? (
      <button type="button" onClick={() => onScan(scannedText.value)}>
        fake-scan
      </button>
    ) : null,
}));

const api = vi.hoisted(() => ({
  getInSeatSession: vi.fn(),
  createInSeatOrder: vi.fn(),
  confirmInSeatMomoPayment: vi.fn(),
  getInSeatOrder: vi.fn(),
  getMyInSeatOrders: vi.fn(),
  getSeatQrSheet: vi.fn(),
}));
vi.mock('../api/inSeat.api', () => api);

import InSeatOrderPage from './InSeatOrderPage';

const TOKEN = 'SQR1.eyJ2IjoxfQ.c2ln';
const assignMock = vi.fn();
const originalLocation = window.location;

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(path: string, { loggedIn = true } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: loggedIn
        ? { accessToken: 'token', userId: '10', role: '1', account: null }
        : { accessToken: null, userId: null, role: null, account: null },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route
              path="/InSeat"
              element={
                <>
                  <InSeatOrderPage />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/Login" element={<LocationProbe />} />
            <Route path="/InSeat/Orders/:code" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function session(overrides: Partial<InSeatSession> = {}): InSeatSession {
  return {
    branch: { id: 1, name: 'CineNova Central' },
    room: { id: 5, name: 'Hall 3' },
    showtime: { id: 7, date: '2026-10-03', time_begin: '19:30', time_end: '21:30' },
    movie: { id: 1, name: 'Dune: Part Three', avatar: null },
    seat: { code: 'E7' },
    ticket: { id: 1000, status: 'ISSUED' },
    booking: { id: 100, code: 'BK-100' },
    ordering: { open: true, reason: null, opens_at: null, closes_at: '2026-10-03T14:15:00.000Z' },
    menu: [
      {
        id: 1,
        name: 'Large Popcorn',
        description: 'Salted',
        price: 65000,
        image: null,
        type: 'FOOD',
      },
      { id: 2, name: 'Coke', description: '', price: 30000, image: null, type: 'BEVERAGE' },
    ],
    orders: [],
    ...overrides,
  };
}

describe('InSeatOrderPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    assignMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignMock, origin: 'http://localhost:3000' },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    sessionStorage.clear();
  });

  it('asks a signed-out visitor to sign in, and brings them back to the same seat afterwards', () => {
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`, { loggedIn: false });
    expect(screen.getByText('Sign in to order')).toBeInTheDocument();
    expect(api.getInSeatSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByTestId('location').textContent).toBe(
      `/Login?next=${encodeURIComponent(`/InSeat?qr=${encodeURIComponent(TOKEN)}`)}`,
    );
  });

  it('without a QR, offers the scanner and refuses a code that is not a seat QR', async () => {
    renderPage('/InSeat');
    expect(screen.getByText('Scan the QR code on your seat')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Seat QR link'), { target: { value: 'TCK-ticket-qr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText(/isn't a seat QR code/)).toBeInTheDocument();
    expect(api.getInSeatSession).not.toHaveBeenCalled();

    api.getInSeatSession.mockResolvedValue(session());
    scannedText.value = `http://localhost:3000/InSeat?qr=${encodeURIComponent(TOKEN)}`;
    fireEvent.click(screen.getByRole('button', { name: /Scan with camera/ }));
    fireEvent.click(screen.getByRole('button', { name: 'fake-scan' }));
    await waitFor(() => expect(api.getInSeatSession).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText('Hall 3')).toBeInTheDocument();
  });

  it('shows why the server refused the seat (e.g. no valid ticket for it)', async () => {
    api.getInSeatSession.mockRejectedValue({
      response: { status: 403, data: { code: 'IN_SEAT_TICKET_REQUIRED', message: 'x' } },
    });
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    expect(
      await screen.findByText(
        'You need a valid ticket for this seat at this showtime to order here.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan a seat QR again/ })).toBeInTheDocument();
  });

  it('builds the order from the menu and pays with MoMo, sending only items and quantities', async () => {
    api.getInSeatSession.mockResolvedValue(session());
    api.createInSeatOrder.mockResolvedValue({
      order: { code: 'CO-1' },
      pay_url: 'https://test-payment.momo.vn/pay/CO-1',
    });
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);

    expect(await screen.findByText('E7')).toBeInTheDocument();
    expect(screen.getByText('Dune: Part Three')).toBeInTheDocument();
    const pay = screen.getByRole('button', { name: /Pay .* with MoMo/ });
    expect(pay).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add one Large Popcorn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add one Large Popcorn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add one Coke' }));
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByTestId('in-seat-total').textContent).toMatch(/160,000/);

    fireEvent.click(screen.getByRole('button', { name: /Pay .*160,000.* with MoMo/ }));
    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith('https://test-payment.momo.vn/pay/CO-1'),
    );
    expect(api.createInSeatOrder).toHaveBeenCalledWith(
      {
        qr: TOKEN,
        items: [
          { combo_id: 1, quantity: 2 },
          { combo_id: 2, quantity: 1 },
        ],
      },
      expect.any(String),
    );
    expect(sessionStorage.getItem('inSeat.lastQr')).toBe(TOKEN); // for "order more"
  });

  it('reuses the idempotency key when the same cart is retried, and starts a new one when it changes', async () => {
    api.getInSeatSession.mockResolvedValue(session());
    api.createInSeatOrder.mockRejectedValue({
      response: { status: 502, data: { code: 'PAYMENT_GATEWAY_ERROR' } },
    });
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    await screen.findByText('E7');

    fireEvent.click(screen.getByRole('button', { name: 'Add one Coke' }));
    fireEvent.click(screen.getByRole('button', { name: /with MoMo/ }));
    expect(
      await screen.findByText('The payment service is unavailable. Please try again.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /with MoMo/ }));
    await waitFor(() => expect(api.createInSeatOrder).toHaveBeenCalledTimes(2));
    const [firstKey, secondKey] = api.createInSeatOrder.mock.calls.map((call) => call[1]);
    expect(secondKey).toBe(firstKey);

    fireEvent.click(screen.getByRole('button', { name: 'Add one Coke' }));
    fireEvent.click(screen.getByRole('button', { name: /with MoMo/ }));
    await waitFor(() => expect(api.createInSeatOrder).toHaveBeenCalledTimes(3));
    expect(api.createInSeatOrder.mock.calls[2][1]).not.toBe(firstKey);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('shows a stock problem in words, with the item', async () => {
    api.getInSeatSession.mockResolvedValue(session());
    api.createInSeatOrder.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'INSUFFICIENT_STOCK', item: 'Large Popcorn', requested: 2, available: 1 },
      },
    });
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    await screen.findByText('E7');
    fireEvent.click(screen.getByRole('button', { name: 'Add one Large Popcorn' }));
    fireEvent.click(screen.getByRole('button', { name: /with MoMo/ }));
    expect(await screen.findByText(/Large Popcorn: 2 needed, 1 available/)).toBeInTheDocument();
  });

  it('before ordering opens: shows the seat and when it opens, but nothing can be ordered', async () => {
    api.getInSeatSession.mockResolvedValue(
      session({
        ordering: {
          open: false,
          reason: 'IN_SEAT_ORDERING_NOT_OPEN',
          opens_at: '2026-10-03T11:30:00.000Z',
          closes_at: '2026-10-03T14:15:00.000Z',
        },
      }),
    );
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    expect(await screen.findByText(/Ordering to your seat opens at/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add one Coke' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /with MoMo/ })).toBeDisabled();
  });

  it('lists what was already ordered to this seat, linking to its live tracking', async () => {
    api.getInSeatSession.mockResolvedValue(
      session({
        orders: [
          {
            id: 1,
            code: 'CO-41',
            status: 'PREPARING',
            items: [],
            total_price: 95000,
            seat: null,
            booking_id: 100,
            payment: null,
            pay_url: null,
            expires_at: null,
            created_at: '2026-10-03T12:00:00.000Z',
            paid_at: null,
            prepared_at: null,
            ready_at: null,
            delivered_at: null,
            cancelled_at: null,
            cancel_reason: null,
          },
        ],
      }),
    );
    renderPage(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    expect(await screen.findByText('Already ordered to this seat')).toBeInTheDocument();
    expect(screen.getByText('Being prepared')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CO-41'));
    expect(screen.getByTestId('location').textContent).toBe('/InSeat/Orders/CO-41');
  });
});
