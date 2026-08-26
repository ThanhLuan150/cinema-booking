import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import * as bookingApi from './booking.api';

describe('booking.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getScheduleId posts to /scheduleId/', async () => {
    const payload = { movie_id: '1', movie_date: '2026-01-01', time_begin: '10:00' };
    await bookingApi.getScheduleId(payload);
    expect(postMock).toHaveBeenCalledWith('/scheduleId/', payload);
  });

  it('getBookedSeats gets /bookseat/:id', async () => {
    await bookingApi.getBookedSeats(5);
    expect(getMock).toHaveBeenCalledWith('/bookseat/5');
  });

  it('getRoomSeats gets /seat/room/:id', async () => {
    await bookingApi.getRoomSeats(1);
    expect(getMock).toHaveBeenCalledWith('/seat/room/1');
  });

  it('holdSeats posts to /bookseat/:id/hold', async () => {
    await bookingApi.holdSeats(5, ['A1', 'A2']);
    expect(postMock).toHaveBeenCalledWith('/bookseat/5/hold', { seatCodes: ['A1', 'A2'] });
  });

  it('releaseSeats posts to /bookseat/:id/release', async () => {
    await bookingApi.releaseSeats(5, ['A1']);
    expect(postMock).toHaveBeenCalledWith('/bookseat/5/release', { seatCodes: ['A1'] });
  });

  it('getSchedule gets /schedule/:id', async () => {
    await bookingApi.getSchedule(5);
    expect(getMock).toHaveBeenCalledWith('/schedule/5');
  });

  it('momoPayment posts to /MomoPayment without an Idempotency-Key header when none is given', async () => {
    const payload = { ticketIds: [1], totalPrice: 1000 } as any;
    await bookingApi.momoPayment(payload);
    expect(postMock).toHaveBeenCalledWith('/MomoPayment', payload, { headers: undefined });
  });

  it('momoPayment sends the Idempotency-Key header when one is given', async () => {
    const payload = { ticketIds: [1], totalPrice: 1000 } as any;
    await bookingApi.momoPayment(payload, 'key-1');
    expect(postMock).toHaveBeenCalledWith('/MomoPayment', payload, { headers: { 'Idempotency-Key': 'key-1' } });
  });

  it('confirmMomoPayment posts to /MomoPayment/confirm', async () => {
    const payload = { orderId: 'X' } as any;
    await bookingApi.confirmMomoPayment(payload);
    expect(postMock).toHaveBeenCalledWith('/MomoPayment/confirm', payload);
  });

  it('getBookTicketSchedule gets /bookticket/:id', async () => {
    await bookingApi.getBookTicketSchedule(5);
    expect(getMock).toHaveBeenCalledWith('/bookticket/5');
  });

  it('getMyInvoices gets /my-invoices', async () => {
    await bookingApi.getMyInvoices();
    expect(getMock).toHaveBeenCalledWith('/my-invoices');
  });

  it('cancelInvoice posts to /invoice/:id/cancel', async () => {
    await bookingApi.cancelInvoice(5);
    expect(postMock).toHaveBeenCalledWith('/invoice/5/cancel');
  });

  it('validateVoucher posts to /voucher/validate', async () => {
    const payload = { code: 'SAVE10' } as any;
    await bookingApi.validateVoucher(payload);
    expect(postMock).toHaveBeenCalledWith('/voucher/validate', payload);
  });

  it('validatePromotion posts to /promotion/validate', async () => {
    const payload = { code: 'PROMO10' } as any;
    await bookingApi.validatePromotion(payload);
    expect(postMock).toHaveBeenCalledWith('/promotion/validate', payload);
  });

  it('getCombos gets /combo with branchId and full-list limit', async () => {
    await bookingApi.getCombos(3);
    expect(getMock).toHaveBeenCalledWith('/combo', { params: { branchId: 3, limit: FULL_LIST_FETCH_LIMIT } });
  });

  it('getRoomsList gets /room with full-list limit', async () => {
    await bookingApi.getRoomsList();
    expect(getMock).toHaveBeenCalledWith('/room', { params: { limit: FULL_LIST_FETCH_LIMIT } });
  });

  it('getBookings gets /bookings with the given params', async () => {
    await bookingApi.getBookings({ page: 2, status: 'PAID' });
    expect(getMock).toHaveBeenCalledWith('/bookings', { params: { page: 2, status: 'PAID' } });
  });

  it('getBookingById gets /bookings/:id', async () => {
    await bookingApi.getBookingById(5);
    expect(getMock).toHaveBeenCalledWith('/bookings/5');
  });

  it('cancelBooking posts to /bookings/:id/cancel', async () => {
    await bookingApi.cancelBooking(5);
    expect(postMock).toHaveBeenCalledWith('/bookings/5/cancel');
  });

  it('getMyTickets gets /my-tickets', async () => {
    await bookingApi.getMyTickets();
    expect(getMock).toHaveBeenCalledWith('/my-tickets');
  });

  it('getTicketById gets /my-tickets/:id', async () => {
    await bookingApi.getTicketById(5);
    expect(getMock).toHaveBeenCalledWith('/my-tickets/5');
  });
});
