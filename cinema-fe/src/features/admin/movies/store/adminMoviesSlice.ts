import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AdminMoviesState } from '../types/adminMovie.types';

const initialState: AdminMoviesState = {
  showAddModal: false,
  showEditModal: false,
  showScheduleModal: false,
  activeMovieId: null,
};

const adminMoviesSlice = createSlice({
  name: 'adminMovies',
  initialState,
  reducers: {
    openAddModal(state) {
      state.showAddModal = true;
    },
    closeAddModal(state) {
      state.showAddModal = false;
    },
    openEditModal(state, action: PayloadAction<number>) {
      state.showEditModal = true;
      state.activeMovieId = action.payload;
    },
    closeEditModal(state) {
      state.showEditModal = false;
    },
    openScheduleModal(state, action: PayloadAction<number>) {
      state.showScheduleModal = true;
      state.activeMovieId = action.payload;
    },
    closeScheduleModal(state) {
      state.showScheduleModal = false;
    },
  },
});

export const { openAddModal, closeAddModal, openEditModal, closeEditModal, openScheduleModal, closeScheduleModal } =
  adminMoviesSlice.actions;
export default adminMoviesSlice.reducer;
