import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
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
    <div className="flex min-h-screen flex-col bg-main">
      <style>{`
        @media print {
          header, footer, .no-print { display: none !important; }
          .booking-card { break-inside: avoid; }
        }
      `}</style>
      <Header />
      <div className="flex-1 mx-auto w-4/5 pb-16 pt-24">
        <h5 className="mb-6 text-2xl text-white">{t('myBookings.pageTitle')}</h5>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}
        {!isLoading && invoices.length === 0 && <EmptyState title={t('myBookings.empty')} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {invoices.map((inv) => {
            const status = INVOICE_STATUS_META[inv.status] || INVOICE_STATUS_META[INVOICE_STATUS.booked];
            const canCancel = inv.status === INVOICE_STATUS.booked;
            return (
              <div key={inv.id} className="booking-card flex gap-4 rounded-lg bg-white/5 p-4">
                <img
                  src={getMoviePosterUrl(inv.movie?.avatar)}
                  alt={inv.movie?.name}
                  className="h-[140px] w-[100px] shrink-0 rounded object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h6 className="text-lg text-white">{inv.movie?.name || t('myBookings.movieFallback')}</h6>
                    <span className={cn('rounded px-2 py-0.5 text-xs', status.className)}>{t(`myBookings.status.${status.key}`)}</span>
                  </div>
                  <p className="mt-1 text-sm text-txt/70">
                    {inv.schedule?.movie_date} · {inv.schedule?.time_begin}
                  </p>
                  <p className="text-sm text-txt/70">
                    {t('myBookings.seatLabel', {
                      code: inv.ticket?.seat_code,
                      type: t(`myBookings.seatType.${SEAT_TYPE_KEY[inv.ticket?.seat_type ?? 0] ?? 'standard'}`),
                    })}
                  </p>
                  <p className="text-sm text-txt/70">{t('myBookings.ticketCode', { code: inv.code })}</p>
                  {inv.discount_amount > 0 && (
                    <p className="text-sm text-accent">
                      {t('myBookings.discount', { amount: `${inv.discount_amount.toLocaleString()}đ` })}
                    </p>
                  )}
                  <p className="mt-1 font-semibold text-white">{inv.total_price.toLocaleString()}đ</p>

                  <div className="mt-3 flex items-center gap-3">
                    <QRCodeSVG value={inv.code} size={64} />
                    <div className="no-print flex flex-col gap-2">
                      <button
                        type="button"
                        className="rounded bg-accent px-3 py-1 text-xs text-white"
                        onClick={() => window.print()}
                      >
                        {t('myBookings.print')}
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          className="rounded bg-red-600 px-3 py-1 text-xs text-white"
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
      </div>
      <Footer />
    </div>
  );
}

export default MyBookingsPage;
