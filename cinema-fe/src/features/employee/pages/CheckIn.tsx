import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCheckInInvoice, useLookupInvoiceForCheckIn } from '../hooks/useInvoiceCheckIn';

function CheckIn() {
  const { t } = useTranslation('employee');
  const [code, setCode] = useState('');
  const { data: invoice, refetch, isFetching, error } = useLookupInvoiceForCheckIn(code);
  const checkInMutation = useCheckInInvoice();

  const handleLookup = useCallback(async () => {
    if (!code) return;
    await refetch();
  }, [code, refetch]);

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

  return (
    <AdminLayout breadcrumb={t('checkIn.breadcrumb')}>
      <div className="max-w-md">
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
    </AdminLayout>
  );
}

export default CheckIn;
