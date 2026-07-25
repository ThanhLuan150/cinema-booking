import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { NotificationState, Toast, ToastType } from './types/toast.types';

const initialState: NotificationState = { toasts: [] };

let nextId = 1;

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    showToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload);
      },
      prepare(message: string, type: ToastType = 'info') {
        return { payload: { id: nextId++, message, type } };
      },
    },
    dismissToast(state, action: PayloadAction<number>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { showToast, dismissToast } = notificationSlice.actions;
export default notificationSlice.reducer;
