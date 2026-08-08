import { createSlice } from '@reduxjs/toolkit';
import type { AdminActorsState } from '../types/actor.types';

const initialState: AdminActorsState = {
  showAddModal: false,
};

const adminActorsSlice = createSlice({
  name: 'adminActors',
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

export const { openAddModal, closeAddModal } = adminActorsSlice.actions;
export default adminActorsSlice.reducer;
