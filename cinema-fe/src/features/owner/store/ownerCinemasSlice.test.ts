import { describe, expect, it } from 'vitest';
import reducer, {
  closeAddRoomModal,
  closeSeatMapModal,
  closeEditRoomModal,
  openAddRoomModal,
  openSeatMapModal,
  openEditRoomModal,
} from './ownerCinemasSlice';

const initialState = reducer(undefined, { type: '@@INIT' });

describe('ownerCinemasSlice', () => {
  it('opens and closes the add room modal', () => {
    const opened = reducer(initialState, openAddRoomModal());
    expect(opened.showAddRoomModal).toBe(true);
    const closed = reducer(opened, closeAddRoomModal());
    expect(closed.showAddRoomModal).toBe(false);
  });

  it('opens the seat map modal with a room id and closes it', () => {
    const opened = reducer(initialState, openSeatMapModal(3));
    expect(opened.seatMapRoomId).toBe(3);
    const closed = reducer(opened, closeSeatMapModal());
    expect(closed.seatMapRoomId).toBeNull();
  });

  it('opens the edit room modal with a room id and closes it', () => {
    const opened = reducer(initialState, openEditRoomModal(3));
    expect(opened.editingRoomId).toBe(3);
    const closed = reducer(opened, closeEditRoomModal());
    expect(closed.editingRoomId).toBeNull();
  });
});
