import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { getApiErrorMessage } from '@/lib/apiError';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useSchedules } from '@/features/admin/schedules/hooks/useSchedules';
import type { Booking } from '../types/booking.types';
import { useBookedSeats } from '../hooks/useBookedSeats';
import { useChangeBookingShowtime } from '../hooks/useChangeBookingShowtime';

const SEAT_AVAILABLE = 1;

export interface ChangeShowtimeModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeShowtimeModal({ booking, onClose, onSuccess }: ChangeShowtimeModalProps) {
  const { t } = useTranslation('booking');
  const requiredSeatCount = booking.tickets.length;

  const [scheduleId, setScheduleId] = useState('');
  const [seatCodes, setSeatCodes] = useState<string[]>([]);

  const { data: schedulesPage } = useSchedules(
    { movieId: booking.movie?.id, branchId: booking.branch_id },
    1,
    FULL_LIST_FETCH_LIMIT,
    Boolean(booking.movie?.id),
  );
  const scheduleOptions = useMemo(() => {
    const now = Date.now();
    return (schedulesPage?.data ?? [])
      .filter((s) => s.id !== booking.schedule_id && s.status !== 'CANCELLED')
      .filter((s) => new Date(`${s.movie_date}T${s.time_begin}:00`).getTime() > now)
      .map((s) => ({ label: `${s.movie_date} ${s.time_begin}`, value: s.id }));
  }, [schedulesPage, booking.schedule_id]);

  const { data: seats } = useBookedSeats(scheduleId || null);
  const changeMutation = useChangeBookingShowtime();

  const toggleSeat = (code: string, status: number) => {
    setSeatCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (status !== SEAT_AVAILABLE) return prev;
      if (prev.length >= requiredSeatCount) return prev;
      return [...prev, code];
    });
  };

  const handleScheduleChange = (value: string) => {
    setScheduleId(value);
    setSeatCodes([]);
  };

  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      await changeMutation.mutateAsync({ bookingId: booking.id, schedule_id: scheduleId, seatCodes });
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('changeShowtime.title')}>
      <p className="text-sm text-txt/70">{t('changeShowtime.description', { count: requiredSeatCount })}</p>
      <Select
        className="mt-3"
        label={t('changeShowtime.scheduleLabel')}
        value={scheduleId}
        onChange={(e) => handleScheduleChange(e.target.value)}
        placeholder={t('changeShowtime.schedulePlaceholder')}
        options={scheduleOptions}
      />

      {scheduleId && (
        <div className="mt-4">
          <p className="text-sm font-medium text-txt/90">
            {t('changeShowtime.seatsLabel', { selected: seatCodes.length, required: requiredSeatCount })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(seats ?? []).map((seat) => {
              const selected = seatCodes.includes(seat.seat_code);
              const disabled = !selected && seat.status !== SEAT_AVAILABLE;
              return (
                <button
                  key={seat.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleSeat(seat.seat_code, seat.status)}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    selected
                      ? 'border-accent bg-accent text-white'
                      : disabled
                        ? 'cursor-not-allowed border-border text-txt/30'
                        : 'border-border-strong text-txt/80 hover:border-accent',
                  )}
                >
                  {seat.seat_code}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={changeMutation.isPending}
          disabled={!scheduleId || seatCodes.length !== requiredSeatCount}
          onClick={handleSubmit}
        >
          {t('common:actions.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
