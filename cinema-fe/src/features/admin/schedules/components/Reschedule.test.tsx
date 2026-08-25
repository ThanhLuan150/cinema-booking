import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const useSchedulesMock = vi.fn();
vi.mock('../hooks/useSchedules', () => ({ useSchedules: (...args: unknown[]) => useSchedulesMock(...args) }));

const rescheduleMutate = vi.fn();
vi.mock('../hooks/useRescheduleSchedule', () => ({
  useRescheduleSchedule: () => ({ mutateAsync: rescheduleMutate, isPending: false }),
}));

import Reschedule from './Reschedule';

const schedule = { id: 1, movie_id: 1, room_id: 1, time_begin: '10:00', time_end: '12:00', movie_date: '2026-01-01', price: 1000, status: 'ACTIVE' as const };

describe('admin schedules Reschedule', () => {
  beforeEach(() => {
    useSchedulesMock.mockReset();
    rescheduleMutate.mockReset();
    useSchedulesMock.mockReturnValue({ data: { data: [] } });
  });

  it('renders the reschedule modal with the current showtime', () => {
    render(<Reschedule schedule={schedule} onClose={() => {}} />);
    expect(screen.getByText('schedules.reschedule.title')).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
  });

  it('greys out a slot that conflicts with another showtime in the same room', () => {
    useSchedulesMock.mockReturnValue({
      data: { data: [{ id: 2, room_id: 1, movie_date: '2026-01-01', time_begin: '14:00', time_end: '16:00', status: 'ACTIVE' }] },
    });
    render(<Reschedule schedule={schedule} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /schedules.add.slot.placeholder/ }));
    expect(screen.getByText(/14:00 - 16:00.*schedules.add.slot.unavailable/)).toBeInTheDocument();
  });

  it('submits the new date/time and closes the modal on success', async () => {
    rescheduleMutate.mockResolvedValue({});
    const onClose = vi.fn();
    render(<Reschedule schedule={schedule} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /schedules.add.slot.placeholder/ }));
    fireEvent.click(screen.getByText('14:00 - 16:00'));
    fireEvent.click(screen.getByText('schedules.reschedule.submit'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(rescheduleMutate).toHaveBeenCalledWith({
      id: 1,
      payload: { movie_date: '2026-01-01', time_begin: '14:00', time_end: '16:00' },
    });
    expect(onClose).toHaveBeenCalled();
  });
});
