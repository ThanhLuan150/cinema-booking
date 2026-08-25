import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Ticket } from '@/features/booking/types/booking.types';
import { useCheckInInvoice, useLookupInvoiceForCheckIn, useVerifyTicketByQr } from '../hooks/useInvoiceCheckIn';
import { QrScanner } from '../components/QrScanner';

const ISSUED_TICKET_BADGE: Record<string, { variant: 'success' | 'default' | 'warning'; key: string }> = {
  ISSUED: { variant: 'default', key: 'statusIssued' },
  USED: { variant: 'success', key: 'statusUsed' },
  CANCELLED: { variant: 'warning', key: 'statusCancelled' },
  REFUNDED: { variant: 'warning', key: 'statusRefunded' },
  EXPIRED: { variant: 'warning', key: 'statusExpired' },
};

function CheckIn() {
  const { t } = useTranslation('employee');
  const [code, setCode] = useState('');
  const { data: invoice, refetch, isFetching, error } = useLookupInvoiceForCheckIn(code);
  const checkInMutation = useCheckInInvoice();

  const [qrToken, setQrToken] = useState('');
  const [scannedTicket, setScannedTicket] = useState<Ticket | null>(null);
  const [qrError, setQrError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const verifyQrMutation = useVerifyTicketByQr();

  const handleLookup = useCallback(async () => {
    if (!code) return;
    await refetch();
  }, [code, refetch]);

  const runVerifyQr = useCallback(
    async (token: string) => {
      setQrError(false);
      try {
        const ticket = await verifyQrMutation.mutateAsync(token);
        setScannedTicket(ticket);
      } catch {
        setScannedTicket(null);
        setQrError(true);
      }
    },
    [verifyQrMutation],
  );

  const handleCheckIn = useCallback(async () => {
    if (!invoice) return;
    try {
      await checkInMutation.mutateAsync(invoice.id);
      toast.success(t('checkIn.checkInSuccess'));
      await refetch();
    } catch (checkInError) {
      toast.error(getApiErrorMessage(checkInError, t));
    }
  }, [invoice, checkInMutation, refetch, t]);

  const handleVerifyQr = useCallback(async () => {
    if (!qrToken) return;
    await runVerifyQr(qrToken);
  }, [qrToken, runVerifyQr]);

  const handleScanDetected = useCallback(
    (token: string) => {
      setScanning(false);
      setQrToken(token);
      runVerifyQr(token);
    },
    [runVerifyQr],
  );

  const handleQrCheckIn = useCallback(async () => {
    if (!scannedTicket) return;
    try {
      await checkInMutation.mutateAsync(scannedTicket.ticket_id);
      toast.success(t('checkIn.checkInSuccess'));
      await handleVerifyQr();
    } catch (checkInError) {
      toast.error(getApiErrorMessage(checkInError, t));
    }
  }, [scannedTicket, checkInMutation, handleVerifyQr, t]);

  const ticketBadge = scannedTicket ? ISSUED_TICKET_BADGE[scannedTicket.status] ?? ISSUED_TICKET_BADGE.ISSUED : null;

  return (
    <AdminLayout breadcrumb={t('checkIn.breadcrumb')}>
      <div className="grid max-w-3xl grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-txt/60">
            {t('checkIn.codeSectionTitle')}
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder={t('checkIn.codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button type="button" variant="secondary" loading={isFetching} onClick={handleLookup}>
              {t('checkIn.lookup')}
            </Button>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{t('checkIn.notFound')}</p>}

          {invoice && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="font-semibold text-white">{invoice.movie?.name}</p>
              <p className="text-sm text-txt/70">{invoice.cinema?.name}</p>
              <p className="text-sm text-txt/70">
                {invoice.schedule?.movie_date} {invoice.schedule?.time_begin}
              </p>
              <p className="text-sm text-txt/70">{invoice.ticket?.seat_code}</p>
              <div className="mt-2">
                {invoice.checked_in ? (
                  <Badge variant="success">{t('checkIn.statusCheckedIn')}</Badge>
                ) : invoice.status === 1 ? (
                  <Badge variant="default">{t('checkIn.statusPaid')}</Badge>
                ) : (
                  <Badge variant="default">{t('checkIn.statusNotPaid')}</Badge>
                )}
              </div>
              <Button
                type="button"
                variant="danger"
                className="mt-4"
                loading={checkInMutation.isPending}
                disabled={invoice.checked_in || invoice.status !== 1}
                onClick={handleCheckIn}
              >
                {t('checkIn.confirmCheckIn')}
              </Button>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-txt/60">
            {t('checkIn.qrSectionTitle')}
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder={t('checkIn.qrPlaceholder')}
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyQr();
              }}
            />
            <Button type="button" variant="secondary" loading={verifyQrMutation.isPending} onClick={handleVerifyQr}>
              {t('checkIn.qrVerify')}
            </Button>
          </div>

          <Button
            type="button"
            variant={scanning ? 'outline' : 'primary'}
            className="mt-3"
            onClick={() => setScanning((prev) => !prev)}
          >
            {scanning ? t('checkIn.stopScan') : t('checkIn.startScan')}
          </Button>
          <QrScanner active={scanning} onScan={handleScanDetected} />

          {qrError && <p className="mt-3 text-sm text-red-400">{t('checkIn.qrNotFound')}</p>}

          {scannedTicket && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="font-semibold text-white">{scannedTicket.movie?.name}</p>
              <p className="text-sm text-txt/70">{scannedTicket.branch?.name}</p>
              <p className="text-sm text-txt/70">
                {scannedTicket.schedule?.movie_date} {scannedTicket.schedule?.time_begin}
              </p>
              <p className="text-sm text-txt/70">
                {t('checkIn.seatLabel', { code: scannedTicket.seat_code })}
              </p>
              <div className="mt-2">
                {ticketBadge && <Badge variant={ticketBadge.variant}>{t(`checkIn.${ticketBadge.key}`)}</Badge>}
              </div>
              <Button
                type="button"
                variant="danger"
                className="mt-4"
                loading={checkInMutation.isPending}
                disabled={scannedTicket.status !== 'ISSUED'}
                onClick={handleQrCheckIn}
              >
                {t('checkIn.confirmCheckIn')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default CheckIn;
