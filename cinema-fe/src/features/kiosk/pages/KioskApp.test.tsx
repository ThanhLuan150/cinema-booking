import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => (opts && 'count' in opts ? `${key}:${opts.count}` : key),
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/notifications/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div> }));

const keyStore = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../api/kioskClient', () => ({
  getStoredKioskKey: () => keyStore.value,
  setStoredKioskKey: (k: string | null) => {
    keyStore.value = k;
  },
}));

const api = vi.hoisted(() => ({
  getKioskSession: vi.fn(),
  getKioskMovies: vi.fn(),
  getKioskShowtimes: vi.fn(),
  getKioskSeats: vi.fn(),
  getKioskCombos: vi.fn(),
  holdKioskSeats: vi.fn(),
  releaseKioskSeats: vi.fn(),
  quoteKioskOrder: vi.fn(),
  checkoutKioskOrder: vi.fn(),
  confirmKioskPayment: vi.fn(),
  getKioskBookingTickets: vi.fn(),
}));
vi.mock('../api/kiosk.api', () => api);

import KioskApp from './KioskApp';

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KioskApp />
    </QueryClientProvider>,
  );
}

describe('KioskApp', () => {
  beforeEach(() => {
    keyStore.value = null;
    Object.values(api).forEach((fn) => fn.mockReset());
    api.getKioskSession.mockResolvedValue({ kiosk: { id: 1, branch_id: 1, kiosk_code: 'K1', name: 'K1', status: 'ACTIVE' }, branch: { id: 1, name: 'Branch A', address: null } });
    api.getKioskMovies.mockResolvedValue([{ id: 10, name: 'Dune' }]);
    api.getKioskCombos.mockResolvedValue([]);
  });

  it('shows the key-activation screen when no key is stored', () => {
    renderApp();
    expect(screen.getByPlaceholderText('KIOSK-...')).toBeInTheDocument();
    expect(screen.getByText('key.activate')).toBeInTheDocument();
  });

  it('activates with a valid key and lands on the movie step', async () => {
    renderApp();
    fireEvent.change(screen.getByPlaceholderText('KIOSK-...'), { target: { value: 'KIOSK-good' } });
    fireEvent.click(screen.getByText('key.activate'));
    await waitFor(() => expect(screen.getByText('steps.movie')).toBeInTheDocument());
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(keyStore.value).toBe('KIOSK-good');
  });

  it('falls back to the key screen when the stored key is rejected', async () => {
    keyStore.value = 'KIOSK-stale';
    api.getKioskSession.mockRejectedValue(new Error('401'));
    renderApp();
    await waitFor(() => expect(screen.getByPlaceholderText('KIOSK-...')).toBeInTheDocument());
    expect(keyStore.value).toBeNull();
  });

  it('returns to the seat step and surfaces the error when payment fails', async () => {
    keyStore.value = 'KIOSK-good';
    api.getKioskShowtimes.mockResolvedValue([
      { id: 99, movie_id: 10, room_id: 1, movie_date: '2999-01-01', time_begin: '10:00', time_end: '12:00', price: 100000, status: 'ACTIVE' },
    ]);
    api.getKioskSeats.mockResolvedValue([
      { id: 1, seat_code: 'A1', seat_type: 0, status: 1, held_by_me: false, price: 100000 },
    ]);
    api.holdKioskSeats.mockResolvedValue({ held: [{ id: 1, seat_code: 'A1', status: 2 }] });
    api.quoteKioskOrder.mockResolvedValue({ seatTotal: 100000, comboTotal: 0, discountAmount: 0, totalPrice: 100000, voucherCode: null, promotionCode: null });
    api.checkoutKioskOrder.mockResolvedValue({ code: 'KIO-1', bookingId: 1, amount: 100000 });
    api.confirmKioskPayment.mockResolvedValue({ paid: false, code: 'KIO-1', reason: 'PAYMENT_FAILED' });

    const { toast } = await import('@/features/notifications/toast');
    renderApp();

    fireEvent.click(await screen.findByText('Dune'));
    fireEvent.click(await screen.findByText(/2999-01-01/));
    fireEvent.click(await screen.findByRole('button', { name: 'A1' }));
    fireEvent.click(screen.getByText('seat.confirm'));

    fireEvent.click(await screen.findByText('next')); // combo -> promo
    fireEvent.click(await screen.findByText('promo.review')); // promo -> payment
    fireEvent.click(await screen.findByText('payment.pay')); // -> terminal
    fireEvent.click(await screen.findByText('payment.simFail'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errors.paymentFailed'));
    expect(await screen.findByText('steps.seat')).toBeInTheDocument();
  });
});
