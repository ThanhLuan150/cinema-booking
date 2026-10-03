import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/apiError';
import { useSeatQrSheet } from '../hooks/useInSeat';
import { buildSeatQrUrl } from '../utils/seatQrLink';

// While printing, only the sheet is visible (the admin layout and the modal chrome are hidden).
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .seat-qr-print, .seat-qr-print * { visibility: visible !important; }
  .seat-qr-print { position: absolute; inset: 0; background: #fff; color: #000; }
  .seat-qr-print .seat-qr-card { break-inside: avoid; border-color: #000; }
  .seat-qr-no-print { display: none !important; }
}`;

export interface SeatQrSheetModalProps {
  scheduleId: number;
  onClose: () => void;
}

/** One QR per seat of a showtime, ready to print and place on (or show at) the seats. */
export function SeatQrSheetModal({ scheduleId, onClose }: SeatQrSheetModalProps) {
  const { t } = useTranslation('inSeat');
  const { data: sheet, isLoading, error } = useSeatQrSheet(scheduleId);

  return (
    <Modal open onClose={onClose} title={t('qrSheet.title')} className="!max-w-5xl">
      <style>{PRINT_CSS}</style>
      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      )}
      {error && <Alert variant="error">{getApiErrorMessage(error, t)}</Alert>}
      {sheet && (
        <div className="flex flex-col gap-4">
          <div className="seat-qr-no-print flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-txt/70">{t('qrSheet.hint')}</p>
            <Button
              type="button"
              onClick={() => window.print()}
              disabled={sheet.seats.length === 0}
            >
              <i className="fa-solid fa-print" aria-hidden="true" />
              {t('qrSheet.print')}
            </Button>
          </div>
          <div className="seat-qr-print flex flex-col gap-3">
            <p className="text-sm font-semibold">
              {t('qrSheet.subtitle', {
                movie: sheet.movie?.name ?? '',
                branch: sheet.branch.name ?? '',
                room: sheet.room.name,
                date: sheet.showtime.date,
                time: sheet.showtime.time_begin,
              })}
            </p>
            {sheet.seats.length === 0 ? (
              <p className="text-sm text-txt/60">{t('qrSheet.empty')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {sheet.seats.map((seat) => (
                  <li
                    key={seat.seat_code}
                    data-testid="seat-qr-card"
                    className="seat-qr-card flex flex-col items-center gap-2 rounded-xl border border-border p-3"
                  >
                    <span className="text-lg font-bold">
                      {t('qrSheet.seat', { seat: seat.seat_code })}
                    </span>
                    <div className="rounded-lg bg-white p-2">
                      <QRCodeSVG
                        value={buildSeatQrUrl(seat.token)}
                        size={132}
                        aria-label={t('qrSheet.qrLabel', { seat: seat.seat_code })}
                      />
                    </div>
                    <span className="text-center text-[11px] leading-tight text-txt/60">
                      {sheet.room.name} · {sheet.showtime.time_begin} · {t('qrSheet.scanToOrder')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
