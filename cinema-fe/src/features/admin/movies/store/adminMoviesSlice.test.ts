import { describe, expect, it } from 'vitest';
import reducer, {
  closeAddModal,
  closeEditModal,
  closeScheduleModal,
  openAddModal,
  openEditModal,
  openScheduleModal,
} from './adminMoviesSlice';

const initialState = reducer(undefined, { type: '@@INIT' });

describe('adminMoviesSlice', () => {
  it('opens and closes the add modal', () => {
    const opened = reducer(initialState, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });

  it('opens the edit modal with the active movie id and closes it', () => {
    const opened = reducer(initialState, openEditModal(10));
    expect(opened.showEditModal).toBe(true);
    expect(opened.activeMovieId).toBe(10);
    const closed = reducer(opened, closeEditModal());
    expect(closed.showEditModal).toBe(false);
  });

  it('opens the schedule modal with the active movie id and closes it', () => {
    const opened = reducer(initialState, openScheduleModal(20));
    expect(opened.showScheduleModal).toBe(true);
    expect(opened.activeMovieId).toBe(20);
    const closed = reducer(opened, closeScheduleModal());
    expect(closed.showScheduleModal).toBe(false);
  });
});
