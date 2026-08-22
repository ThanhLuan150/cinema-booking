import { createSlice } from '@reduxjs/toolkit';
import type { OwnerHolidaysState } from '../types/owner.types';

const initialState: OwnerHolidaysState = {
  showAddModal: false,
};

const ownerHolidaysSlice = createSlice({
  name: 'ownerHolidays',
  initialState,
  reducers: {
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
  },
});

export const { openAddModal, closeAddModal } = ownerHolidaysSlice.actions;
export default ownerHolidaysSlice.reducer;
