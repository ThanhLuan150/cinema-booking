import { createSlice } from '@reduxjs/toolkit';
import type { OwnerGiftCardsState } from '../types/owner.types';

const initialState: OwnerGiftCardsState = {
  showAddModal: false,
};

const ownerGiftCardsSlice = createSlice({
  name: 'ownerGiftCards',
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

export const { openAddModal, closeAddModal } = ownerGiftCardsSlice.actions;
export default ownerGiftCardsSlice.reducer;
