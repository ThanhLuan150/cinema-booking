import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerEmployeesState } from '../types/owner.types';

const initialState: OwnerEmployeesState = {
  selectedCinemaId: '',
  showAddModal: false,
};

const ownerEmployeesSlice = createSlice({
  name: 'ownerEmployees',
  initialState,
  reducers: {
    setSelectedCinemaId(state, action: PayloadAction<string>) {
      state.selectedCinemaId = action.payload;
    },
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
  },
});

export const { setSelectedCinemaId, openAddModal, closeAddModal } = ownerEmployeesSlice.actions;
export default ownerEmployeesSlice.reducer;
