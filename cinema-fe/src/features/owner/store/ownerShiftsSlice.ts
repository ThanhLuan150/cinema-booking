import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerShiftsState } from '../types/owner.types';

const initialState: OwnerShiftsState = {
  selectedbranchId: '',
  showAddModal: false,
  editingShiftId: null,
  showAssignModal: false,
};

const ownerShiftsSlice = createSlice({
  name: 'ownerShifts',
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
    openEditModal(state, action: PayloadAction<number>) {
      state.editingShiftId = action.payload;
    },
    closeEditModal(state) {
      state.editingShiftId = null;
    },
    openAssignModal(state) {
      state.showAssignModal = true;
    },
    closeAssignModal(state) {
      state.showAssignModal = false;
    },
  },
});

export const {
  setSelectedbranchId,
  openAddModal,
  closeAddModal,
  openEditModal,
  closeEditModal,
  openAssignModal,
  closeAssignModal,
} = ownerShiftsSlice.actions;
export default ownerShiftsSlice.reducer;
