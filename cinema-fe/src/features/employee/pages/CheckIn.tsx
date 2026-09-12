import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import type { Ticket } from '@/features/booking/types/booking.types';
import { useCheckInInvoice, useLookupInvoiceForCheckIn, useVerifyTicketByQr } from '../hooks/useInvoiceCheckIn';
import { CheckInCodeLookupPanel } from '../components/CheckInCodeLookupPanel';
import { CheckInQrScanPanel } from '../components/CheckInQrScanPanel';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';

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

  return (
    <AdminLayout breadcrumb={t('checkIn.breadcrumb')}>
      <div className="grid max-w-3xl grid-cols-1 gap-8 md:grid-cols-2">
        <CheckInCodeLookupPanel
          code={code}
          invoice={invoice}
          isFetching={isFetching}
          error={error}
          checkInPending={checkInMutation.isPending}
          onCodeChange={setCode}
          onLookup={handleLookup}
          onCheckIn={handleCheckIn}
        />

        <CheckInQrScanPanel
          qrToken={qrToken}
          scannedTicket={scannedTicket}
          qrError={qrError}
          scanning={scanning}
          verifyPending={verifyQrMutation.isPending}
          checkInPending={checkInMutation.isPending}
          onQrTokenChange={setQrToken}
          onVerify={handleVerifyQr}
          onToggleScanning={() => setScanning((prev) => !prev)}
          onScanDetected={handleScanDetected}
          onCheckIn={handleQrCheckIn}
        />
      </div>
    </AdminLayout>
  );
}

export default CheckIn;
