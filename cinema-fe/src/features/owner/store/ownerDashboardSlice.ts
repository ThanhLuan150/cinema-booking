import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerDashboardState } from '../types/owner.types';

const initialState: OwnerDashboardState = {
  selectedCinemaId: '',
};

const ownerDashboardSlice = createSlice({
  name: 'ownerDashboard',
  initialState,
  reducers: {
    setSelectedCinemaId(state, action: PayloadAction<string>) {
      state.selectedCinemaId = action.payload;
    },
  },
});

export const { setSelectedCinemaId } = ownerDashboardSlice.actions;
export default ownerDashboardSlice.reducer;
