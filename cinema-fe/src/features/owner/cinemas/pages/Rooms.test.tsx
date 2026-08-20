import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerCinemasReducer from '../../store/ownerCinemasSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'rooms.seatMapModal.seatTypeLabels' && opts?.returnObjects
          ? ['Standard', 'Vip', 'Couple']
          : key === 'rooms.seatMapModal.title'
            ? `Seat map: ${opts?.roomName}`
            : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useRoomsByCinemaMock = vi.fn();
vi.mock('../../hooks/useRoomsByCinema', () => ({
  useRoomsByCinema: (...args: unknown[]) => useRoomsByCinemaMock(...args),
}));

const createRoomMutate = vi.fn();
vi.mock('../../hooks/useCreateRoom', () => ({ useCreateRoom: () => ({ mutateAsync: createRoomMutate, isPending: false }) }));

const updateRoomMutate = vi.fn();
vi.mock('../../hooks/useUpdateRoom', () => ({ useUpdateRoom: () => ({ mutateAsync: updateRoomMutate, isPending: false }) }));

const deleteRoomMutate = vi.fn();
vi.mock('../../hooks/useDeleteRoom', () => ({ useDeleteRoom: () => ({ mutateAsync: deleteRoomMutate }) }));

const useSeatsByRoomMock = vi.fn();
vi.mock('../../hooks/useSeatsByRoom', () => ({ useSeatsByRoom: (...args: unknown[]) => useSeatsByRoomMock(...args) }));

const generateSeatMapMutate = vi.fn();
vi.mock('../../hooks/useGenerateSeatMap', () => ({
  useGenerateSeatMap: () => ({ mutateAsync: generateSeatMapMutate, isPending: false }),
}));

const updateSeatMutate = vi.fn();
vi.mock('../../hooks/useUpdateSeat', () => ({ useUpdateSeat: () => ({ mutateAsync: updateSeatMutate }) }));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import Rooms from './Rooms';

const baseRoom = { id: 10, name: 'Room 1', code: 'R1', type: '2D', capacity: 40, status: 'ACTIVE' as const };

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerCinemas: ownerCinemasReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Rooms />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Rooms', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useRoomsByCinemaMock.mockReset();
    createRoomMutate.mockReset();
    updateRoomMutate.mockReset();
    deleteRoomMutate.mockReset();
    useSeatsByRoomMock.mockReset();
    generateSeatMapMutate.mockReset();
    updateSeatMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useSeatsByRoomMock.mockReturnValue({ data: [] });
  });

  it('renders rooms for the auto-selected cinema', () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [baseRoom] } });
    renderPage();
    expect(screen.getByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('deletes a room after confirming', async () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [baseRoom] } });
    confirmDialogMock.mockResolvedValue(true);
    deleteRoomMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('rooms.delete'));
    await waitFor(() => expect(deleteRoomMutate).toHaveBeenCalledWith(10));
  });

  it('opens the add-room modal and submits a new room', async () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [] } });
    createRoomMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('rooms.addButton'));
    expect(screen.getByText('rooms.addTitle')).toBeInTheDocument();

    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Room 2' } });
    fireEvent.change(document.querySelector('input[name="code"]')!, { target: { value: 'R2' } });
    fireEvent.change(document.querySelector('input[name="capacity"]')!, { target: { value: '50' } });
    fireEvent.click(screen.getByText('rooms.submit'));

    await waitFor(() =>
      expect(createRoomMutate).toHaveBeenCalledWith({ name: 'Room 2', cinema_id: 1, code: 'R2', type: '2D', capacity: 50 }),
    );
  });

  it('rejects submitting the add-room form without a code', async () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [] } });
    renderPage();

    fireEvent.click(screen.getByText('rooms.addButton'));
    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Room 2' } });
    fireEvent.change(document.querySelector('input[name="capacity"]')!, { target: { value: '50' } });
    fireEvent.click(screen.getByText('rooms.submit'));

    await waitFor(() => expect(screen.getByText('rooms.validation.codeRequired')).toBeInTheDocument());
    expect(createRoomMutate).not.toHaveBeenCalled();
  });

  it('opens the edit-room modal and submits changes, including status', async () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [baseRoom] } });
    updateRoomMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('rooms.edit'));
    expect(screen.getByText('rooms.editTitle')).toBeInTheDocument();

    fireEvent.change(document.querySelector('input[name="capacity"]')!, { target: { value: '60' } });
    fireEvent.click(screen.getByText('rooms.saveButton'));

    await waitFor(() =>
      expect(updateRoomMutate).toHaveBeenCalledWith({
        id: 10,
        name: 'Room 1',
        code: 'R1',
        type: '2D',
        capacity: 60,
        status: 'ACTIVE',
      }),
    );
  });

  it('opens the seat map modal and disables a seat', async () => {
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [baseRoom] } });
    useSeatsByRoomMock.mockReturnValue({
      data: [{ id: 99, seat_code: 'A1', seat_type: 0, status: 'ACTIVE' }],
    });
    updateSeatMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('rooms.seatMapAction'));
    expect(screen.getByText('A1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('A1'));
    await waitFor(() => expect(updateSeatMutate).toHaveBeenCalledWith({ id: 99, status: 'DISABLED' }));
  });
});
