import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerCinemasState } from '../types/owner.types';

const initialState: OwnerCinemasState = {
  showAddCinemaModal: false,
  showAddRoomModal: false,
  seatMapRoomId: null,
};

const ownerCinemasSlice = createSlice({
  name: 'ownerCinemas',
  initialState,
  reducers: {
    openAddCinemaModal(state) {
      state.showAddCinemaModal = true;
    },
    closeAddCinemaModal(state) {
      state.showAddCinemaModal = false;
    },
    openAddRoomModal(state) {
      state.showAddRoomModal = true;
    },
    closeAddRoomModal(state) {
      state.showAddRoomModal = false;
    },
    openSeatMapModal(state, action: PayloadAction<number>) {
      state.seatMapRoomId = action.payload;
    },
    closeSeatMapModal(state) {
      state.seatMapRoomId = null;
    },
  },
});

export const {
  openAddCinemaModal,
  closeAddCinemaModal,
  openAddRoomModal,
  closeAddRoomModal,
  openSeatMapModal,
  closeSeatMapModal,
} = ownerCinemasSlice.actions;
export default ownerCinemasSlice.reducer;
