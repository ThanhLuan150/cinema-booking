import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerPromotionsState } from '../types/owner.types';

const initialState: OwnerPromotionsState = {
  showAddModal: false,
  editingPromotionId: null,
};

const ownerPromotionsSlice = createSlice({
  name: 'ownerPromotions',
  initialState,
  reducers: {
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.editingPromotionId = action.payload;
    },
    closeEditModal(state) {
      state.editingPromotionId = null;
    },
  },
});

export const { openAddModal, closeAddModal, openEditModal, closeEditModal } = ownerPromotionsSlice.actions;
export default ownerPromotionsSlice.reducer;
