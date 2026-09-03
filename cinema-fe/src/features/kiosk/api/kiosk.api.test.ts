import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('./kioskClient', () => ({
  default: { get: (...a: unknown[]) => getMock(...a), post: (...a: unknown[]) => postMock(...a) },
}));

import * as kioskApi from './kiosk.api';

describe('kiosk.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
    postMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('session / movies / combos', async () => {
    await kioskApi.getKioskSession();
    expect(getMock).toHaveBeenCalledWith('/kiosks/session');
    await kioskApi.getKioskMovies();
    expect(getMock).toHaveBeenCalledWith('/kiosks/movies');
    await kioskApi.getKioskCombos();
    expect(getMock).toHaveBeenCalledWith('/kiosks/combos');
  });

  it('showtimes / seats are scoped by id', async () => {
    await kioskApi.getKioskShowtimes(7);
    expect(getMock).toHaveBeenCalledWith('/kiosks/movies/7/showtimes');
    await kioskApi.getKioskSeats(3);
    expect(getMock).toHaveBeenCalledWith('/kiosks/showtimes/3/seats');
  });

  it('hold / release post seatCodes', async () => {
    await kioskApi.holdKioskSeats(3, ['A1', 'A2']);
    expect(postMock).toHaveBeenCalledWith('/kiosks/showtimes/3/hold', { seatCodes: ['A1', 'A2'] });
    await kioskApi.releaseKioskSeats(3, ['A1']);
    expect(postMock).toHaveBeenCalledWith('/kiosks/showtimes/3/release', { seatCodes: ['A1'] });
  });

  it('checkout sends an Idempotency-Key header', async () => {
    await kioskApi.checkoutKioskOrder(
      { scheduleId: 3, ticketIds: [1], comboIds: [], voucherCode: null, promotionCode: null },
      'idem-1',
    );
    expect(postMock).toHaveBeenCalledWith(
      '/kiosks/checkout',
      { scheduleId: 3, ticketIds: [1], comboIds: [], voucherCode: null, promotionCode: null },
      { headers: { 'Idempotency-Key': 'idem-1' } },
    );
  });

  it('confirm posts the terminal outcome', async () => {
    await kioskApi.confirmKioskPayment('KIO-1', 'FAILURE', 'CARD');
    expect(postMock).toHaveBeenCalledWith('/kiosks/checkout/KIO-1/confirm', { outcome: 'FAILURE', method: 'CARD' });
  });

  it('bookingTickets is scoped by code', async () => {
    await kioskApi.getKioskBookingTickets('KIO-1');
    expect(getMock).toHaveBeenCalledWith('/kiosks/bookings/KIO-1/tickets');
  });
});
