import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerCinemasState } from '../types/owner.types';

const initialState: OwnerCinemasState = {
  showAddRoomModal: false,
  seatMapRoomId: null,
  editingRoomId: null,
};

const ownerCinemasSlice = createSlice({
  name: 'ownerCinemas',
  initialState,
  reducers: {
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
    openEditRoomModal(state, action: PayloadAction<number>) {
      state.editingRoomId = action.payload;
    },
    closeEditRoomModal(state) {
      state.editingRoomId = null;
    },
  },
});

export const {
  openAddRoomModal,
  closeAddRoomModal,
  openSeatMapModal,
  closeSeatMapModal,
  openEditRoomModal,
  closeEditRoomModal,
} = ownerCinemasSlice.actions;
export default ownerCinemasSlice.reducer;
