import { describe, expect, it } from 'vitest';
import type { BookedSeatTicket, VoucherValidationResult } from '../types/booking.types';
import reducer, {
  applyVoucherFailure,
  applyVoucherSuccess,
  clearVoucher,
  resetBookingSelection,
  setbranchId,
  setMomoPayUrl,
  setPaymentResult,
  setScheduleId,
  setSelectedDay,
  setSelectedTime,
  setShowtime,
  setVoucherCode,
  toggleCombo,
  toggleSeat,
} from './bookingSlice';

const initialState = reducer(undefined, { type: '@@INIT' });

const ticketA = { id: 1, seat_code: 'A1' } as unknown as BookedSeatTicket;
const ticketB = { id: 2, seat_code: 'A2' } as unknown as BookedSeatTicket;

describe('bookingSlice', () => {
  it('setShowtime stores movie/date/time info', () => {
    const state = reducer(
      initialState,
      setShowtime({ movieId: 'm1', movieDate: '2026-01-01', timeBegin: '10:00' }),
    );
    expect(state.movieId).toBe('m1');
    expect(state.movieDate).toBe('2026-01-01');
    expect(state.timeBegin).toBe('10:00');
  });

  it('setScheduleId and setbranchId update their fields', () => {
    let state = reducer(initialState, setScheduleId(42));
    expect(state.scheduleId).toBe(42);
    state = reducer(state, setbranchId(7));
    expect(state.branchId).toBe(7);
  });

  it('setSelectedDay resets the selected time', () => {
    const withTime = reducer(initialState, setSelectedTime('18:00'));
    const state = reducer(withTime, setSelectedDay('2026-02-01'));
    expect(state.selectedDay).toBe('2026-02-01');
    expect(state.selectedTime).toBe('');
  });

  it('toggleSeat adds then removes a seat/ticket', () => {
    const added = reducer(initialState, toggleSeat(ticketA));
    expect(added.selectedSeatCodes).toEqual(['A1']);
    expect(added.selectedTickets).toEqual([ticketA]);

    const addedTwo = reducer(added, toggleSeat(ticketB));
    expect(addedTwo.selectedSeatCodes).toEqual(['A1', 'A2']);

    const removed = reducer(addedTwo, toggleSeat(ticketA));
    expect(removed.selectedSeatCodes).toEqual(['A2']);
    expect(removed.selectedTickets).toEqual([ticketB]);
  });

  it('toggleCombo adds then removes a combo id', () => {
    const added = reducer(initialState, toggleCombo(5));
    expect(added.selectedComboIds).toEqual([5]);
    const removed = reducer(added, toggleCombo(5));
    expect(removed.selectedComboIds).toEqual([]);
  });

  it('setVoucherCode updates the voucher code', () => {
    const state = reducer(initialState, setVoucherCode('SAVE10'));
    expect(state.voucherCode).toBe('SAVE10');
  });

  it('applyVoucherSuccess sets the result and clears the error', () => {
    const result = { discount: 1000 } as unknown as VoucherValidationResult;
    const withError = { ...initialState, voucherError: 'bad code' };
    const state = reducer(withError, applyVoucherSuccess(result));
    expect(state.voucherResult).toEqual(result);
    expect(state.voucherError).toBe('');
  });

  it('applyVoucherFailure sets the error and clears the result', () => {
    const state = reducer(initialState, applyVoucherFailure('Invalid voucher'));
    expect(state.voucherError).toBe('Invalid voucher');
    expect(state.voucherResult).toBeNull();
  });

  it('clearVoucher resets voucher result and error', () => {
    const dirty = reducer(initialState, applyVoucherFailure('Invalid voucher'));
    const state = reducer(dirty, clearVoucher());
    expect(state.voucherResult).toBeNull();
    expect(state.voucherError).toBe('');
  });

  it('setMomoPayUrl stores the pay url', () => {
    const state = reducer(initialState, setMomoPayUrl('https://momo.pay/xyz'));
    expect(state.momoPayUrl).toBe('https://momo.pay/xyz');
  });

  it('setPaymentResult stores status and message', () => {
    const state = reducer(initialState, setPaymentResult({ status: 'success', message: 'Paid' }));
    expect(state.paymentStatus).toBe('success');
    expect(state.paymentMessage).toBe('Paid');
  });

  it('resetBookingSelection restores the initial state', () => {
    const dirty = reducer(initialState, setVoucherCode('SAVE10'));
    const state = reducer(dirty, resetBookingSelection());
    expect(state).toEqual(initialState);
  });
});
