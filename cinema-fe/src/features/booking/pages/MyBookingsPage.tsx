import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMyInvoices } from '../hooks/useMyInvoices';
import { useCancelInvoice } from '../hooks/useCancelInvoice';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { INVOICE_STATUS, INVOICE_STATUS_META } from '@/constants/invoiceStatus';

function MyBookingsPage() {
  const { t } = useTranslation('booking');
  const { data: invoices = [], isLoading } = useMyInvoices();
  const cancelInvoiceMutation = useCancelInvoice();

  const handleCancel = async (invoiceId: number) => {
    if (!(await confirmDialog(t('myBookings.confirmCancel')))) return;
    try {
      await cancelInvoiceMutation.mutateAsync(invoiceId);
      toast.success(t('myBookings.cancelSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('myBookings.cancelFailed'));
    }
  };

  return (
    <AccountLayout title={t('myBookings.pageTitle')}>
      <style>{`
        @media print {
          header, footer, .no-print { display: none !important; }
          .booking-card { break-inside: avoid; }
        }
      `}</style>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && invoices.length === 0 && (
        <EmptyState title={t('myBookings.empty')} icon="fa-solid fa-ticket" />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {invoices.map((inv) => {
          const status =
            INVOICE_STATUS_META[inv.status] || INVOICE_STATUS_META[INVOICE_STATUS.booked];
          const canCancel = inv.status === INVOICE_STATUS.booked;
          return (
            <div
              key={inv.id}
              className="booking-card flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <img
                src={getMoviePosterUrl(inv.movie?.avatar)}
                alt={inv.movie?.name}
                className="h-[140px] w-[100px] shrink-0 rounded-lg object-cover shadow-card"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h6 className="text-lg font-semibold text-white">
                    {inv.movie?.name || t('myBookings.movieFallback')}
                  </h6>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      status.className,
                    )}
                  >
                    {t(`myBookings.status.${status.key}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-txt/70">
                  {inv.schedule?.movie_date} · {inv.schedule?.time_begin}
                </p>
                <p className="text-sm text-txt/70">
                  {t('myBookings.seatLabel', {
                    code: inv.ticket?.seat_code,
                    type: t(
                      `myBookings.seatType.${SEAT_TYPE_KEY[inv.ticket?.seat_type ?? 0] ?? 'standard'}`,
                    ),
                  })}
                </p>
                <p className="text-sm text-txt/70">
                  {t('myBookings.ticketCode', { code: inv.code })}
                </p>
                {inv.discount_amount > 0 && (
                  <p className="text-sm text-accent">
                    {t('myBookings.discount', {
                      amount: `${inv.discount_amount.toLocaleString()}đ`,
                    })}
                  </p>
                )}
                <p className="mt-1 font-semibold text-white">{inv.total_price.toLocaleString()}đ</p>

                <div className="mt-3 flex items-center gap-3">
                  <QRCodeSVG value={inv.code} size={64} />
                  <div className="no-print flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-card transition-colors hover:bg-accent-hover"
                      onClick={() => window.print()}
                    >
                      <i className="fa-solid fa-print mr-1" />
                      {t('myBookings.print')}
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        className="rounded-lg border border-red-800/60 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                        onClick={() => handleCancel(inv.id)}
                      >
                        {t('myBookings.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AccountLayout>
  );
}

export default MyBookingsPage;
