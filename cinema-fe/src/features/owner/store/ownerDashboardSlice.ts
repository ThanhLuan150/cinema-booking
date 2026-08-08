import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerDashboardState } from '../types/owner.types';

const initialState: OwnerDashboardState = {
  selectedbranchId: '',
};

const ownerDashboardSlice = createSlice({
  name: 'ownerDashboard',
  initialState,
  reducers: {
    setSelectedbranchId(state, action: PayloadAction<string>) {
      state.selectedbranchId = action.payload;
    },
  },
});

export const { setSelectedbranchId } = ownerDashboardSlice.actions;
export default ownerDashboardSlice.reducer;
