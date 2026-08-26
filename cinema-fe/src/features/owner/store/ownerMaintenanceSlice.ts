import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerMaintenanceState } from '../types/owner.types';

const initialState: OwnerMaintenanceState = {
  selectedbranchId: '',
  showAddModal: false,
  assignRequestId: null,
  resolveRequestId: null,
};

const ownerMaintenanceSlice = createSlice({
  name: 'ownerMaintenance',
  initialState,
  reducers: {
    setSelectedbranchId(state, action: PayloadAction<string>) {
      state.selectedbranchId = action.payload;
    },
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
    openAssignModal(state, action: PayloadAction<number>) {
      state.assignRequestId = action.payload;
    },
    closeAssignModal(state) {
      state.assignRequestId = null;
    },
    openResolveModal(state, action: PayloadAction<number>) {
      state.resolveRequestId = action.payload;
    },
    closeResolveModal(state) {
      state.resolveRequestId = null;
    },
  },
});

export const {
  setSelectedbranchId,
  openAddModal,
  closeAddModal,
  openAssignModal,
  closeAssignModal,
  openResolveModal,
  closeResolveModal,
} = ownerMaintenanceSlice.actions;
export default ownerMaintenanceSlice.reducer;
