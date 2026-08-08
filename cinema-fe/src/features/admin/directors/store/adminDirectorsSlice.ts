import { createSlice } from '@reduxjs/toolkit';
import type { AdminDirectorsState } from '../types/director.types';

const initialState: AdminDirectorsState = {
  showAddModal: false,
};

const adminDirectorsSlice = createSlice({
  name: 'adminDirectors',
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

export const { openAddModal, closeAddModal } = adminDirectorsSlice.actions;
export default adminDirectorsSlice.reducer;
