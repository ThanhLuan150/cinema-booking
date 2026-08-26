import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerInventoryState, StockActionMode } from '../types/owner.types';

const initialState: OwnerInventoryState = {
  showAddModal: false,
  stockAction: null,
  historyItemId: null,
};

const ownerInventorySlice = createSlice({
  name: 'ownerInventory',
  initialState,
  reducers: {
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
    openStockAction(state, action: PayloadAction<{ id: number; mode: StockActionMode }>) {
      state.stockAction = action.payload;
    },
    closeStockAction(state) {
      state.stockAction = null;
    },
    openHistory(state, action: PayloadAction<number>) {
      state.historyItemId = action.payload;
    },
    closeHistory(state) {
      state.historyItemId = null;
    },
  },
});

export const { openAddModal, closeAddModal, openStockAction, closeStockAction, openHistory, closeHistory } =
  ownerInventorySlice.actions;
export default ownerInventorySlice.reducer;
