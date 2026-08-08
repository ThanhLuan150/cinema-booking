import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminMoviesReducer from '../store/adminMoviesSlice';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./Delete', () => ({ default: () => <button>Delete</button> }));

const useAuthRoleMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => useAuthRoleMock() }));

import ListItem from './ListItem';
import { ROLES } from '@/constants/roles';

function renderItem(movie: any) {
  const store = configureStore({ reducer: { adminMovies: adminMoviesReducer } });
  return {
    ...render(
      <Provider store={store}>
        <table>
          <tbody>
            <ListItem movie={movie} />
          </tbody>
        </table>
      </Provider>,
    ),
    store,
  };
}

const baseMovie = {
  id: 1,
  name: 'Movie A',
  avatar: '',
  premiere_date: '2026-01-01',
  country: 'US',
  description: 'Desc',
  trailer: '',
  categories: [{ id: 1, name: 'Action' }],
};

describe('admin movies ListItem', () => {
  beforeEach(() => useAuthRoleMock.mockReset());

  it('renders movie details', () => {
    useAuthRoleMock.mockReturnValue(ROLES.owner);
    renderItem(baseMovie);
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('shows the add-showtime action for a branch admin (owner) on an active movie', () => {
    useAuthRoleMock.mockReturnValue(ROLES.owner);
    renderItem(baseMovie);
    expect(document.querySelector('ion-icon[name="add-circle-outline"]')).toBeInTheDocument();
  });

  it('shows the add-showtime action for super admin on an active movie', () => {
    useAuthRoleMock.mockReturnValue(ROLES.admin);
    renderItem(baseMovie);
    expect(document.querySelector('ion-icon[name="add-circle-outline"]')).toBeInTheDocument();
  });

  it('hides the add-showtime action for an INACTIVE movie', () => {
    useAuthRoleMock.mockReturnValue(ROLES.owner);
    renderItem({ ...baseMovie, status: 'INACTIVE' });
    expect(document.querySelector('ion-icon[name="add-circle-outline"]')).not.toBeInTheDocument();
  });

  it('hides the add-showtime action for an employee', () => {
    useAuthRoleMock.mockReturnValue(ROLES.employee);
    renderItem(baseMovie);
    expect(document.querySelector('ion-icon[name="add-circle-outline"]')).not.toBeInTheDocument();
  });

  it('hides Edit/Delete for a branch admin (Movie Catalog is view-only for them)', () => {
    useAuthRoleMock.mockReturnValue(ROLES.owner);
    renderItem(baseMovie);
    expect(document.querySelector('ion-icon[name="pencil-outline"]')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows Edit/Delete for super admin', () => {
    useAuthRoleMock.mockReturnValue(ROLES.admin);
    renderItem(baseMovie);
    expect(document.querySelector('ion-icon[name="pencil-outline"]')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('dispatches openEditModal when the edit button is clicked', () => {
    useAuthRoleMock.mockReturnValue(ROLES.admin);
    const { store } = renderItem(baseMovie);
    fireEvent.click(document.querySelector('button')!);
    expect(store.getState().adminMovies.showEditModal).toBe(true);
    expect(store.getState().adminMovies.activeMovieId).toBe(1);
  });
});
