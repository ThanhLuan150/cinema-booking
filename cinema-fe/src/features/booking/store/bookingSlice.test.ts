import { describe, expect, it } from 'vitest';
import type { BookedSeatTicket, PromotionValidationResult, VoucherValidationResult } from '../types/booking.types';
import reducer, {
  applyPromotionFailure,
  applyPromotionSuccess,
  applyVoucherFailure,
  applyVoucherSuccess,
  clearPromotion,
  clearVoucher,
  resetBookingSelection,
  setbranchId,
  setMomoPayUrl,
  setPaymentResult,
  setPromotionCode,
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

  it('setPromotionCode updates the promotion code', () => {
    const state = reducer(initialState, setPromotionCode('PROMO10'));
    expect(state.promotionCode).toBe('PROMO10');
  });

  it('applyPromotionSuccess sets the result and clears the error', () => {
    const result = { discount_amount: 1000 } as unknown as PromotionValidationResult;
    const withError = { ...initialState, promotionError: 'bad code' };
    const state = reducer(withError, applyPromotionSuccess(result));
    expect(state.promotionResult).toEqual(result);
    expect(state.promotionError).toBe('');
  });

  it('applyPromotionFailure sets the error and clears the result', () => {
    const state = reducer(initialState, applyPromotionFailure('Invalid promotion'));
    expect(state.promotionError).toBe('Invalid promotion');
    expect(state.promotionResult).toBeNull();
  });

  it('clearPromotion resets promotion result and error', () => {
    const dirty = reducer(initialState, applyPromotionFailure('Invalid promotion'));
    const state = reducer(dirty, clearPromotion());
    expect(state.promotionResult).toBeNull();
    expect(state.promotionError).toBe('');
  });

  it('a customer can only apply one of a voucher or a promotion at a time', () => {
    const voucherResult = { discount_amount: 1000 } as unknown as VoucherValidationResult;
    const promotionResult = { discount_amount: 2000 } as unknown as PromotionValidationResult;

    const withVoucher = reducer(
      { ...initialState, promotionCode: 'PROMO10' },
      applyVoucherSuccess(voucherResult),
    );
    expect(withVoucher.voucherResult).toEqual(voucherResult);
    expect(withVoucher.promotionCode).toBe('');
    expect(withVoucher.promotionResult).toBeNull();

    const withPromotion = reducer(withVoucher, applyPromotionSuccess(promotionResult));
    expect(withPromotion.promotionResult).toEqual(promotionResult);
    expect(withPromotion.voucherCode).toBe('');
    expect(withPromotion.voucherResult).toBeNull();
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
