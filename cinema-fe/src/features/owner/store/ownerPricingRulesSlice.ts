import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerPricingRulesState } from '../types/owner.types';

const initialState: OwnerPricingRulesState = {
  showAddModal: false,
  editingRuleId: null,
};

const ownerPricingRulesSlice = createSlice({
  name: 'ownerPricingRules',
  initialState,
  reducers: {
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.editingRuleId = action.payload;
    },
    closeEditModal(state) {
      state.editingRuleId = null;
    },
  },
});

export const { openAddModal, closeAddModal, openEditModal, closeEditModal } = ownerPricingRulesSlice.actions;
export default ownerPricingRulesSlice.reducer;
