import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from '@/features/notifications/toast';
import { SEAT_TYPE_CLASS, SEAT_TYPE_KEY, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import { useBookedSeats } from '../hooks/useBookedSeats';
import { useRoomSeats } from '../hooks/useRoomSeats';
import { useSeatSwapOptions, useSeatSwapQuote, useSwapSeat } from '../hooks/useSeatSwap';
import type { SeatSwapQuote, Ticket } from '../types/booking.types';

type CellState = 'CURRENT' | 'AVAILABLE' | 'TAKEN' | 'DISABLED';
interface Cell {
  seatCode: string;
  seatType: number;
  state: CellState;
}

interface ErrorWithQuote {
  response?: { data?: { quote?: SeatSwapQuote } };
}

export interface SeatSwapModalProps {
  ticket: Ticket;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SeatSwapModal({ ticket, onClose, onSuccess }: SeatSwapModalProps) {
  const { t } = useTranslation('booking');
  const queryClient = useQueryClient();
  const ticketId = ticket.ticket_id;

  const { data: options, isLoading: loadingOptions } = useSeatSwapOptions(ticketId);
  const eligible = Boolean(options?.eligible);
  const showtimeId = eligible ? (options?.showtime?.id ?? null) : null;
  const roomId = eligible ? (options?.showtime?.room_id ?? null) : null;
  const { data: seatTickets = [], isLoading: loadingSeats } = useBookedSeats(showtimeId);
  const { data: roomSeats = [] } = useRoomSeats(roomId);

  const quoteMutation = useSeatSwapQuote(ticketId);
  const swapMutation = useSwapSeat(ticketId, showtimeId);

  const [selected, setSelected] = useState<string | null>(null);
  const [quote, setQuote] = useState<SeatSwapQuote | null>(null);
  const [refusedQuote, setRefusedQuote] = useState<SeatSwapQuote | null>(null);
  const [error, setError] = useState('');

  const currentSeat = options?.seat?.seat_code ?? ticket.seat_code;

  const rows = useMemo(() => {
    const disabled = new Set(
      roomSeats.filter((s) => s.status === 'DISABLED').map((s) => s.seat_code),
    );
    const cells: Cell[] = seatTickets.map((seat) => ({
      seatCode: seat.seat_code,
      seatType: seat.seat_type,
      state:
        seat.seat_code === currentSeat
          ? 'CURRENT'
          : disabled.has(seat.seat_code)
            ? 'DISABLED'
            : seat.status === TICKET_STATUS.available
              ? 'AVAILABLE'
              : 'TAKEN',
    }));
    const byRow = new Map<string, Cell[]>();
    for (const cell of cells) {
      const match = cell.seatCode.match(/^([A-Za-z]+)(\d+)$/);
      const row = match ? match[1] : cell.seatCode;
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(cell);
    }
    const seatNumber = (code: string) => Number(code.replace(/^[A-Za-z]+/, '')) || 0;
    return [...byRow.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([row, rowCells]) => ({
        row,
        cells: rowCells.sort((a, b) => seatNumber(a.seatCode) - seatNumber(b.seatCode)),
      }));
  }, [seatTickets, roomSeats, currentSeat]);

  const refreshSeats = () => {
    if (showtimeId) queryClient.invalidateQueries({ queryKey: ['bookedSeats', showtimeId] });
  };

  // Select New Seat -> Check Availability (the server prices both seats and applies the policy).
  const handleSelect = async (seatCode: string) => {
    setSelected(seatCode);
    setQuote(null);
    setRefusedQuote(null);
    setError('');
    try {
      setQuote(await quoteMutation.mutateAsync(seatCode));
    } catch (err) {
      setError(getApiErrorMessage(err, t));
      setRefusedQuote((err as ErrorWithQuote)?.response?.data?.quote ?? null);
      refreshSeats();
    }
  };

  const handleConfirm = async () => {
    if (!selected || !quote) return;
    setError('');
    try {
      const result = await swapMutation.mutateAsync(selected);
      toast.success(
        t('seatSwap.success', { from: result.swap.from_seat_code, to: result.swap.to_seat_code }),
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, t));
      setQuote(null);
      refreshSeats();
    }
  };

  const shownQuote = quote ?? refusedQuote;

  return (
    <Modal open onClose={onClose} title={t('seatSwap.title')} className="!max-w-2xl">
      {loadingOptions ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : !options || !eligible ? (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
          role="alert"
        >
          <p className="font-semibold">{t('seatSwap.notAllowedTitle')}</p>
          <p className="mt-1">
            {options?.reason
              ? t(`errors:${options.reason.code}`, { defaultValue: options.reason.message })
              : t('errors:GENERIC')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-txt/70">
            {t('seatSwap.description', { seat: currentSeat })}{' '}
            {t(`seatSwap.policy.${options.policy?.price_policy ?? 'SAME_PRICE_ONLY'}`)}
          </p>

          <div className="mt-4 rounded-xl border border-border bg-surface/60 p-4">
            <div className="mx-auto mb-2 h-2 w-4/5 rounded-full bg-white/60" />
            <p className="mb-4 text-center text-[10px] uppercase tracking-widest text-txt/50">
              {t('bookSeat.screen')}
            </p>
            {loadingSeats ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-1 overflow-x-auto"
                data-testid="seat-swap-grid"
              >
                {rows.map(({ row, cells }) => (
                  <div key={row} className="flex gap-1">
                    {cells.map((cell) => {
                      const isSelected = cell.seatCode === selected;
                      const selectable = cell.state === 'AVAILABLE' && !swapMutation.isPending;
                      return (
                        <button
                          key={cell.seatCode}
                          type="button"
                          disabled={!selectable}
                          aria-pressed={isSelected}
                          title={t(`seatSwap.cell.${cell.state}`)}
                          onClick={() => selectable && handleSelect(cell.seatCode)}
                          className={cn(
                            'flex h-8 w-9 items-center justify-center rounded-t-lg text-[10px] font-semibold text-black transition-transform',
                            cell.state === 'CURRENT' &&
                              'cursor-default bg-sky-400 ring-2 ring-white',
                            cell.state === 'TAKEN' && 'cursor-not-allowed bg-white/25',
                            cell.state === 'DISABLED' &&
                              'cursor-not-allowed bg-white/10 text-white/30 line-through',
                            cell.state === 'AVAILABLE' &&
                              cn(
                                'hover:scale-110',
                                SEAT_TYPE_CLASS[cell.seatType] ??
                                  SEAT_TYPE_CLASS[SEAT_TYPES.standard],
                                isSelected &&
                                  'scale-110 bg-emerald-500 text-white ring-2 ring-white',
                              ),
                          )}
                        >
                          {cell.seatCode}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-txt/60">
              <Legend className="bg-sky-400" label={t('seatSwap.cell.CURRENT')} />
              <Legend className="bg-emerald-500" label={t('seatSwap.legend.selected')} />
              <Legend className="bg-white/25" label={t('seatSwap.cell.TAKEN')} />
              <Legend
                className={SEAT_TYPE_CLASS[SEAT_TYPES.vip]}
                label={t('myBookings.seatType.vip')}
              />
              <Legend
                className={SEAT_TYPE_CLASS[SEAT_TYPES.couple]}
                label={t('myBookings.seatType.couple')}
              />
            </div>
          </div>

          {quoteMutation.isPending && (
            <p className="mt-3 flex items-center gap-2 text-sm text-txt/70">
              <Spinner size="sm" /> {t('seatSwap.checking')}
            </p>
          )}

          {shownQuote && (
            <dl
              className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border p-4 text-sm"
              data-testid="seat-swap-quote"
            >
              <dt className="text-txt/60">{t('seatSwap.quote.from')}</dt>
              <dd className="text-right font-medium text-white">
                {shownQuote.from.seat_code} (
                {t(`myBookings.seatType.${SEAT_TYPE_KEY[shownQuote.from.seat_type] ?? 'standard'}`)}
                ){' · '}
                {formatCurrency(shownQuote.from.price ?? 0)}
              </dd>
              <dt className="text-txt/60">{t('seatSwap.quote.to')}</dt>
              <dd className="text-right font-medium text-white">
                {shownQuote.to.seat_code} (
                {t(`myBookings.seatType.${SEAT_TYPE_KEY[shownQuote.to.seat_type] ?? 'standard'}`)})
                {' · '}
                {formatCurrency(shownQuote.to.price ?? 0)}
              </dd>
              <dt className="text-txt/60">{t('seatSwap.quote.difference')}</dt>
              <dd className="text-right font-semibold text-white">
                {shownQuote.price_difference > 0 ? '+' : shownQuote.price_difference < 0 ? '−' : ''}
                {formatCurrency(Math.abs(shownQuote.price_difference))}
              </dd>
              {quote?.settlement && (
                <p className="col-span-2 mt-1 text-xs text-txt/60">
                  {t(`seatSwap.settlement.${quote.settlement}`)}
                </p>
              )}
            </dl>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        {eligible && (
          <Button
            type="button"
            loading={swapMutation.isPending}
            disabled={!quote || quoteMutation.isPending}
            onClick={handleConfirm}
          >
            {t('seatSwap.confirm')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('inline-block h-3 w-3 rounded-sm', className)} />
      {label}
    </span>
  );
}
