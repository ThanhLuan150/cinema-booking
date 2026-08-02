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

const useMovieDetailMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovieDetail', () => ({ useMovieDetail: (...args: unknown[]) => useMovieDetailMock(...args) }));

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
    useMovieDetailMock.mockReset();
    createScheduleMutate.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42 }] } });
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [] }, isFetching: false, isFetched: true });
    useMovieDetailMock.mockReturnValue({ data: { owner_id: 42 }, isFetched: true });
  });

  it('renders the add-schedule modal', () => {
    renderModal();
    expect(screen.getByText('schedules.add.title')).toBeInTheDocument();
  });

  it('scopes cinema options to the movie owner', () => {
    useMyCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Owned', owner_id: 42 }, { id: 2, name: 'NotOwned', owner_id: 99 }] },
    });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /schedules.add.cinema.placeholder/ }));
    expect(screen.getByText('Owned')).toBeInTheDocument();
    expect(screen.queryByText('NotOwned')).not.toBeInTheDocument();
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
