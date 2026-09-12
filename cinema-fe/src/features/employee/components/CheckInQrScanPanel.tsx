import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { Ticket } from '@/features/booking/types/booking.types';
import { QrScanner } from './QrScanner';
import { ISSUED_TICKET_BADGE } from '../constants';

export function CheckInQrScanPanel({
  qrToken,
  scannedTicket,
  qrError,
  scanning,
  verifyPending,
  checkInPending,
  onQrTokenChange,
  onVerify,
  onToggleScanning,
  onScanDetected,
  onCheckIn,
}: {
  qrToken: string;
  scannedTicket: Ticket | null;
  qrError: boolean;
  scanning: boolean;
  verifyPending: boolean;
  checkInPending: boolean;
  onQrTokenChange: (value: string) => void;
  onVerify: () => void;
  onToggleScanning: () => void;
  onScanDetected: (token: string) => void;
  onCheckIn: () => void;
}) {
  const { t } = useTranslation('employee');
  const ticketBadge = scannedTicket ? ISSUED_TICKET_BADGE[scannedTicket.status] ?? ISSUED_TICKET_BADGE.ISSUED : null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-txt/60">
        {t('checkIn.qrSectionTitle')}
      </h2>
      <div className="flex gap-2">
        <Input
          placeholder={t('checkIn.qrPlaceholder')}
          value={qrToken}
          onChange={(e) => onQrTokenChange(e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onVerify();
          }}
        />
        <Button type="button" variant="secondary" loading={verifyPending} onClick={onVerify}>
          {t('checkIn.qrVerify')}
        </Button>
      </div>

      <Button type="button" variant={scanning ? 'outline' : 'primary'} className="mt-3" onClick={onToggleScanning}>
        {scanning ? t('checkIn.stopScan') : t('checkIn.startScan')}
      </Button>
      <QrScanner active={scanning} onScan={onScanDetected} />

      {qrError ? <p className="mt-3 text-sm text-red-400">{t('checkIn.qrNotFound')}</p> : null}

      {scannedTicket && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="font-semibold text-white">{scannedTicket.movie?.name}</p>
          <p className="text-sm text-txt/70">{scannedTicket.branch?.name}</p>
          <p className="text-sm text-txt/70">
            {scannedTicket.schedule?.movie_date} {scannedTicket.schedule?.time_begin}
          </p>
          <p className="text-sm text-txt/70">{t('checkIn.seatLabel', { code: scannedTicket.seat_code })}</p>
          <div className="mt-2">
            {ticketBadge && <Badge variant={ticketBadge.variant}>{t(`checkIn.${ticketBadge.key}`)}</Badge>}
          </div>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            loading={checkInPending}
            disabled={scannedTicket.status !== 'ISSUED'}
            onClick={onCheckIn}
          >
            {t('checkIn.confirmCheckIn')}
          </Button>
        </div>
      )}
    </div>
  );
}
