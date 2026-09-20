import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RealtimeState } from './types/realtime.types';

const initialState: RealtimeState = {
  cinemaStatusVersion: 0,
  ownerBookingVersion: 0,
  seatMapVersion: 0,
  checkinVersion: 0,
  operationsVersion: 0,
  catalogueVersion: 0,
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    bump(state, action: PayloadAction<keyof RealtimeState>) {
      state[action.payload] += 1;
    },
  },
});

export const { bump } = realtimeSlice.actions;
export default realtimeSlice.reducer;
