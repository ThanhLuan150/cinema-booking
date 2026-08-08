import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerEmployeesState } from '../types/owner.types';

const initialState: OwnerEmployeesState = {
  selectedbranchId: '',
  showAddModal: false,
};

const ownerEmployeesSlice = createSlice({
  name: 'ownerEmployees',
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
  },
});

export const { setSelectedbranchId, openAddModal, closeAddModal } = ownerEmployeesSlice.actions;
export default ownerEmployeesSlice.reducer;
