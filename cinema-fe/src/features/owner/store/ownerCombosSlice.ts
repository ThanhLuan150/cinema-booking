import { createSlice } from '@reduxjs/toolkit';
import type { OwnerCombosState } from '../types/owner.types';

const initialState: OwnerCombosState = {
  showAddModal: false,
};

const ownerCombosSlice = createSlice({
  name: 'ownerCombos',
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

export const { openAddModal, closeAddModal } = ownerCombosSlice.actions;
export default ownerCombosSlice.reducer;
