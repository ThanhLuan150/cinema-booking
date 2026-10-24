import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useBookedSeats } from '@/features/booking/hooks/useBookedSeats';
import { useHoldSeats } from '@/features/booking/hooks/useHoldSeats';
import { setSeatHoldExpiry, toggleSeat } from '@/features/booking/store/bookingSlice';
import { useCancelWaitlistEntry, useJoinWaitlist, useShowtimeWaitlist, waitlistQueryKey } from '../hooks/useWaitlist';
import { formatCountdown, secondsLeft } from '../lib/waitlist';
import type { WaitlistEntry } from '../types/waitlist.types';

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt));
  useEffect(() => {
    setLeft(secondsLeft(expiresAt));
    if (!expiresAt) return undefined;
    const timer = setInterval(() => setLeft(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return left;
}

function OfferBanner({ entry, scheduleId, onDecline, declining }: {
  entry: WaitlistEntry;
  scheduleId: number;
  onDecline: () => void;
  declining: boolean;
}) {
  const { t } = useTranslation('waitlist');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedSeatCodes = useAppSelector((state) => state.booking.selectedSeatCodes);
  const { data: tickets = [] } = useBookedSeats(scheduleId);
  const holdSeats = useHoldSeats(scheduleId);
  const left = useCountdown(entry.expires_at);

  // When the offer runs out the server hands the seats on; catch up with it.
  useEffect(() => {
    if (left === 0) queryClient.invalidateQueries({ queryKey: waitlistQueryKey });
  }, [left, queryClient]);

  const unselected = entry.offered_seat_codes.filter((code) => !selectedSeatCodes.includes(code));

  const selectReservedSeats = () => {
    holdSeats.mutate(unselected, {
      onSuccess: (result) => {
        for (const code of unselected) {
          const ticket = tickets.find((tk) => tk.seat_code === code);
          if (!ticket) continue;
          dispatch(toggleSeat(ticket));
          if (result?.held_until) dispatch(setSeatHoldExpiry({ seatCode: code, heldUntil: result.held_until }));
        }
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, t));
        queryClient.invalidateQueries({ queryKey: waitlistQueryKey });
        queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
      },
    });
  };

  return (
    <div className="rounded-2xl border border-accent/60 bg-accent/10 p-5 shadow-card" data-testid="waitlist-offer">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">
            <i className="fa-solid fa-bell mr-2 text-accent" aria-hidden="true" />
            {t('panel.offer.title', { count: entry.offered_seat_codes.length })}
          </p>
          <p className="mt-1 text-sm text-txt/80">
            {t('panel.offer.body', { seats: entry.offered_seat_codes.join(', ') })}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-white" aria-label={t('panel.offer.timeLeft')}>
          {formatCountdown(left)}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {unselected.length > 0 && (
          <Button type="button" variant="danger" size="sm" loading={holdSeats.isPending} onClick={selectReservedSeats}>
            {t('panel.offer.selectSeats')}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" loading={declining} onClick={onDecline}>
          {t('panel.offer.decline')}
        </Button>
      </div>
    </div>
  );
}

/** Sold-out showtime: join its waitlist, see your place in it, or take up the seats it reserved for you. */
export function WaitlistPanel({ scheduleId }: { scheduleId: number | null }) {
  const { t } = useTranslation('waitlist');
  const { data: status } = useShowtimeWaitlist(scheduleId);
  const join = useJoinWaitlist();
  const cancel = useCancelWaitlistEntry();
  const [seatCount, setSeatCount] = useState(1);

  if (!scheduleId || !status) return null;
  const { entry } = status;

  const handleJoin = async () => {
    try {
      await join.mutateAsync({ schedule_id: scheduleId, seat_count: seatCount });
      toast.success(t('panel.joined'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCancel = async (confirmKey: string) => {
    if (!entry || !(await confirmDialog(t(confirmKey)))) return;
    try {
      await cancel.mutateAsync(entry.id);
      toast.success(t('panel.left'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  if (entry?.status === 'NOTIFIED') {
    return (
      <OfferBanner
        entry={entry}
        scheduleId={scheduleId}
        declining={cancel.isPending}
        onDecline={() => handleCancel('panel.offer.declineConfirm')}
      />
    );
  }

  if (entry?.status === 'WAITING') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card" data-testid="waitlist-waiting">
        <p className="font-semibold text-white">
          <i className="fa-solid fa-hourglass-half mr-2 text-amber-400" aria-hidden="true" />
          {t('panel.waiting.title', { position: entry.position })}
        </p>
        <p className="mt-1 text-sm text-txt/70">
          {t('panel.waiting.body', { count: entry.seat_count, minutes: status.offer_minutes })}
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-red-500 hover:text-red-400"
          onClick={() => handleCancel('panel.waiting.leaveConfirm')}
          disabled={cancel.isPending}
        >
          {t('panel.waiting.leave')}
        </button>
      </div>
    );
  }

  if (!status.full || !status.can_join) return null;

  const max = Math.max(1, status.max_seat_count);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card" data-testid="waitlist-join">
      <p className="font-semibold text-white">
        <i className="fa-solid fa-user-clock mr-2 text-accent" aria-hidden="true" />
        {t('panel.join.title')}
      </p>
      <p className="mt-1 text-sm text-txt/70">{t('panel.join.body', { minutes: status.offer_minutes })}</p>
      {status.waiting_count > 0 && (
        <p className="mt-1 text-xs text-txt/55">{t('panel.join.queueLength', { count: status.waiting_count })}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2" role="group" aria-label={t('panel.join.seatCount')}>
          <span className="text-sm text-txt/70">{t('panel.join.seatCount')}</span>
          <button
            type="button"
            className="h-8 w-8 rounded-lg border border-border text-white disabled:opacity-40"
            onClick={() => setSeatCount((n) => Math.max(1, n - 1))}
            disabled={seatCount <= 1}
            aria-label={t('panel.join.fewer')}
          >
            −
          </button>
          <span className="w-6 text-center font-semibold text-white" data-testid="waitlist-seat-count">
            {seatCount}
          </span>
          <button
            type="button"
            className="h-8 w-8 rounded-lg border border-border text-white disabled:opacity-40"
            onClick={() => setSeatCount((n) => Math.min(max, n + 1))}
            disabled={seatCount >= max}
            aria-label={t('panel.join.more')}
          >
            +
          </button>
        </div>
        <Button type="button" variant="danger" size="sm" loading={join.isPending} onClick={handleJoin}>
          {t('panel.join.submit')}
        </Button>
      </div>
    </div>
  );
}
