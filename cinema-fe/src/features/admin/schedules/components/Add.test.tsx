import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useMyCinemasMock = vi.fn();
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({ useMyCinemas: () => useMyCinemasMock() }));

const useRoomsByCinemaMock = vi.fn();
vi.mock('@/features/owner/hooks/useRoomsByCinema', () => ({
  useRoomsByCinema: (...args: unknown[]) => useRoomsByCinemaMock(...args),
}));

const useMyMoviesMock = vi.fn();
vi.mock('../../movies/hooks/useMyMovies', () => ({ useMyMovies: (...args: unknown[]) => useMyMoviesMock(...args) }));

const createScheduleMutate = vi.fn();
vi.mock('../hooks/useCreateSchedule', () => ({
  useCreateSchedule: () => ({ mutateAsync: createScheduleMutate, isPending: false }),
}));

import Add from './Add';

function renderModal(id: number | string | null = 5) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Add id={id} handleCloseAddSchedule={() => {}} />
    </MemoryRouter>,
  );
}

describe('admin schedules Add', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useRoomsByCinemaMock.mockReset();
    useMyMoviesMock.mockReset();
    createScheduleMutate.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42 }] } });
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [] }, isFetching: false, isFetched: true });
    useMyMoviesMock.mockReturnValue({ data: { data: [{ id: 7, name: 'Active Movie' }] } });
  });

  it('renders the add-schedule modal', () => {
    renderModal();
    expect(screen.getByText('schedules.add.title')).toBeInTheDocument();
  });

  it('does not show a movie picker when opened with a preset movie id', () => {
    renderModal(5);
    expect(screen.queryByText('schedules.add.movie.label')).not.toBeInTheDocument();
  });

  it('shows a movie picker restricted to ACTIVE movies when opened without a preset movie', () => {
    renderModal(null);
    expect(screen.getByText('schedules.add.movie.label')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /schedules.add.movie.placeholder/ }));
    expect(screen.getByText('Active Movie')).toBeInTheDocument();
    expect(useMyMoviesMock).toHaveBeenCalledWith(1, expect.any(Number), 'ACTIVE');
  });

  it('offers every branch useMyCinemas returns (already scoped server-side to the caller)', () => {
    useMyCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Branch A', owner_id: 42 }, { id: 2, name: 'Branch B', owner_id: 42 }] },
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /schedules.add.cinema.placeholder/ }));
    expect(screen.getByText('Branch A')).toBeInTheDocument();
    expect(screen.getByText('Branch B')).toBeInTheDocument();
  });

  it('shows a hint when the selected cinema has no rooms', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /schedules.add.cinema.placeholder/ }));
    fireEvent.click(screen.getByText('Cinema A'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('schedules.add.room.noRoomsHint')).toBeInTheDocument();
  });
});
