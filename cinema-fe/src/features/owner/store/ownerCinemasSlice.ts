import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OwnerCinemasState } from '../types/owner.types';

const initialState: OwnerCinemasState = {
  showAddRoomModal: false,
  seatMapRoomId: null,
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
  },
});

export const { openAddRoomModal, closeAddRoomModal, openSeatMapModal, closeSeatMapModal } =
  ownerCinemasSlice.actions;
export default ownerCinemasSlice.reducer;
