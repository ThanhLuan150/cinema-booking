import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConfirmRequest, ConfirmState } from './types/confirm.types';

const initialState: ConfirmState = { request: null };

const confirmSlice = createSlice({
  name: 'confirm',
  initialState,
  reducers: {
    openConfirm(state, action: PayloadAction<ConfirmRequest>) {
      state.request = action.payload;
    },
    closeConfirm(state) {
      state.request = null;
    },
  },
});

export const { openConfirm, closeConfirm } = confirmSlice.actions;
export default confirmSlice.reducer;
