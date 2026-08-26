import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  BookedSeatTicket,
  BookingState,
  PaymentStatus,
  PromotionValidationResult,
  VoucherValidationResult,
} from '../types/booking.types';

const initialState: BookingState = {
  movieId: null,
  movieDate: null,
  timeBegin: null,
  scheduleId: null,
  branchId: null,
  selectedDay: '',
  selectedTime: '',
  selectedSeatCodes: [],
  selectedTickets: [],
  heldUntilBySeat: {},
  selectedComboIds: [],
  voucherCode: '',
  voucherResult: null,
  voucherError: '',
  promotionCode: '',
  promotionResult: null,
  promotionError: '',
  momoPayUrl: '',
  paymentStatus: 'confirming',
  paymentMessage: '',
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setShowtime(state, action: PayloadAction<{ movieId: string; movieDate: string; timeBegin: string }>) {
      const { movieId, movieDate, timeBegin } = action.payload;
      state.movieId = movieId;
      state.movieDate = movieDate;
      state.timeBegin = timeBegin;
    },
    setScheduleId(state, action: PayloadAction<number>) {
      state.scheduleId = action.payload;
    },
    setSelectedDay(state, action: PayloadAction<string>) {
      state.selectedDay = action.payload;
      state.selectedTime = '';
    },
    setSelectedTime(state, action: PayloadAction<string>) {
      state.selectedTime = action.payload;
    },
    setbranchId(state, action: PayloadAction<number | null>) {
      state.branchId = action.payload;
    },
    toggleSeat(state, action: PayloadAction<BookedSeatTicket>) {
      const ticket = action.payload;
      const isSelected = state.selectedSeatCodes.includes(ticket.seat_code);
      state.selectedSeatCodes = isSelected
        ? state.selectedSeatCodes.filter((code) => code !== ticket.seat_code)
        : [...state.selectedSeatCodes, ticket.seat_code];
      state.selectedTickets = isSelected
        ? state.selectedTickets.filter((t) => t.id !== ticket.id)
        : [...state.selectedTickets, ticket];
      if (isSelected) delete state.heldUntilBySeat[ticket.seat_code];
    },
    setSeatHoldExpiry(state, action: PayloadAction<{ seatCode: string; heldUntil: string }>) {
      state.heldUntilBySeat[action.payload.seatCode] = action.payload.heldUntil;
    },
    clearExpiredSelection(state) {
      state.selectedSeatCodes = [];
      state.selectedTickets = [];
      state.heldUntilBySeat = {};
    },
    toggleCombo(state, action: PayloadAction<number>) {
      const comboId = action.payload;
      state.selectedComboIds = state.selectedComboIds.includes(comboId)
        ? state.selectedComboIds.filter((id) => id !== comboId)
        : [...state.selectedComboIds, comboId];
    },
    setVoucherCode(state, action: PayloadAction<string>) {
      state.voucherCode = action.payload;
    },
    // A customer applies a voucher OR a promotion to an order, never both — succeeding with
    // one clears any result already held for the other.
    applyVoucherSuccess(state, action: PayloadAction<VoucherValidationResult>) {
      state.voucherResult = action.payload;
      state.voucherError = '';
      state.promotionCode = '';
      state.promotionResult = null;
      state.promotionError = '';
    },
    applyVoucherFailure(state, action: PayloadAction<string>) {
      state.voucherResult = null;
      state.voucherError = action.payload;
    },
    clearVoucher(state) {
      state.voucherResult = null;
      state.voucherError = '';
    },
    setPromotionCode(state, action: PayloadAction<string>) {
      state.promotionCode = action.payload;
    },
    applyPromotionSuccess(state, action: PayloadAction<PromotionValidationResult>) {
      state.promotionResult = action.payload;
      state.promotionError = '';
      state.voucherCode = '';
      state.voucherResult = null;
      state.voucherError = '';
    },
    applyPromotionFailure(state, action: PayloadAction<string>) {
      state.promotionResult = null;
      state.promotionError = action.payload;
    },
    clearPromotion(state) {
      state.promotionResult = null;
      state.promotionError = '';
    },
    setMomoPayUrl(state, action: PayloadAction<string>) {
      state.momoPayUrl = action.payload;
    },
    setPaymentResult(state, action: PayloadAction<{ status: PaymentStatus; message: string }>) {
      state.paymentStatus = action.payload.status;
      state.paymentMessage = action.payload.message;
    },
    resetBookingSelection() {
      return initialState;
    },
  },
});

export const {
  setShowtime,
  setScheduleId,
  setbranchId,
  setSelectedDay,
  setSelectedTime,
  toggleSeat,
  setSeatHoldExpiry,
  clearExpiredSelection,
  toggleCombo,
  setVoucherCode,
  applyVoucherSuccess,
  applyVoucherFailure,
  clearVoucher,
  setPromotionCode,
  applyPromotionSuccess,
  applyPromotionFailure,
  clearPromotion,
  setMomoPayUrl,
  setPaymentResult,
  resetBookingSelection,
} = bookingSlice.actions;
export default bookingSlice.reducer;
