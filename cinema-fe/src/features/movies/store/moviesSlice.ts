import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MovieFilters, MoviesState } from '../types/movie.types';

const initialState: MoviesState = {
  filters: {},
};

const moviesSlice = createSlice({
  name: 'movies',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<MovieFilters>) {
      state.filters = action.payload;
    },
    resetFilters(state, action: PayloadAction<MovieFilters | undefined>) {
      state.filters = action.payload ?? {};
    },
  },
});

export const { setFilters, resetFilters } = moviesSlice.actions;
export default moviesSlice.reducer;
