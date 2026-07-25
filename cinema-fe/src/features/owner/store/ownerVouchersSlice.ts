import { createSlice } from '@reduxjs/toolkit';
import type { OwnerVouchersState } from '../types/owner.types';

const initialState: OwnerVouchersState = {
  showAddModal: false,
};

const ownerVouchersSlice = createSlice({
  name: 'ownerVouchers',
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

export const { openAddModal, closeAddModal } = ownerVouchersSlice.actions;
export default ownerVouchersSlice.reducer;
