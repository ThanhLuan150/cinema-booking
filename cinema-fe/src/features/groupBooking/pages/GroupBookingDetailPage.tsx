import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import { BOOKING_STATUS_META } from '@/constants/bookingStatus';
import { useCancelGroupBooking, useGroupBooking } from '../hooks/useGroupBooking';

const formatVnd = (value: number) => `${value.toLocaleString()}đ`;

/** /GroupBooking/:code — one group booking: its seats, combos, organizer, payment and (once paid) tickets. */
function GroupBookingDetailPage() {
  const { code = '' } = useParams();
  const { t } = useTranslation(['groupBooking', 'booking']);
  const { data: booking, isLoading, error } = useGroupBooking(code);
  const cancelMutation = useCancelGroupBooking();

  const handleCancel = async () => {
    if (!window.confirm(t('detail.cancelConfirm'))) return;
    try {
      await cancelMutation.mutateAsync(code);
      toast.success(t('detail.cancelled'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t));
    }
  };

  const status = booking ? BOOKING_STATUS_META[booking.status] || BOOKING_STATUS_META.PENDING : null;

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-16 pt-24 text-white">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}
        {error && <Alert variant="error">{getApiErrorMessage(error, t)}</Alert>}

        {booking && status && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t('detail.title')}</p>
                <h1 className="mt-1 text-2xl font-bold">{booking.movie?.name ?? booking.code}</h1>
                <p className="text-sm text-txt/60">
                  {booking.schedule?.movie_date} · {booking.schedule?.time_begin} · {booking.branch?.name} · {booking.room?.name}
                </p>
                <p className="text-sm text-txt/60">{t('detail.code', { code: booking.code })}</p>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-sm font-medium', status.className)} data-testid="group-status">
                {t(`booking:myBookings.status.${status.key}`)}
              </span>
            </header>

            {booking.status === 'PENDING' && (
              <Alert variant="info">
                {t('detail.pendingNotice', {
                  time: booking.expires_at ? new Date(booking.expires_at).toLocaleTimeString() : '',
                })}
              </Alert>
            )}
            {booking.payment?.status === 'REFUND_PENDING' && <Alert variant="warning">{t('detail.refundPending')}</Alert>}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-3 font-semibold">{t('detail.seats', { count: booking.seats.length })}</h2>
                <p className="flex flex-wrap gap-1.5">
                  {booking.seats.map((seat) => (
                    <span key={seat.ticket_id} className="rounded bg-white/10 px-2 py-0.5 text-sm">
                      {seat.seat_code}
                    </span>
                  ))}
                </p>
                {booking.combos.length > 0 && (
                  <>
                    <h2 className="mb-2 mt-4 font-semibold">{t('detail.combos')}</h2>
                    <ul className="text-sm text-txt/80">
                      {booking.combos.map((line) => (
                        <li key={line.combo_id}>{t('summary.comboLine', { name: line.name, quantity: line.quantity })}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-3 font-semibold">{t('detail.organizer')}</h2>
                {booking.group && (
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-txt/60">{t('organizer.typeLabel')}</dt>
                    <dd>{t(`organizer.type.${booking.group.organizer_type}`)}</dd>
                    {booking.group.group_name && (
                      <>
                        <dt className="text-txt/60">{t('organizer.groupName')}</dt>
                        <dd>{booking.group.group_name}</dd>
                      </>
                    )}
                    {booking.group.company_name && (
                      <>
                        <dt className="text-txt/60">{t('organizer.companyName')}</dt>
                        <dd>{booking.group.company_name}</dd>
                      </>
                    )}
                    {booking.group.tax_code && (
                      <>
                        <dt className="text-txt/60">{t('organizer.taxCode')}</dt>
                        <dd>{booking.group.tax_code}</dd>
                      </>
                    )}
                    {booking.group.contact_name && (
                      <>
                        <dt className="text-txt/60">{t('organizer.contactName')}</dt>
                        <dd>{booking.group.contact_name}</dd>
                      </>
                    )}
                  </dl>
                )}
                <dl className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-txt/60">{t('summary.seats', { count: booking.seats.length })}</dt>
                    <dd>{formatVnd(booking.seat_total)}</dd>
                  </div>
                  {booking.combo_total > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-txt/60">{t('detail.combos')}</dt>
                      <dd>{formatVnd(booking.combo_total)}</dd>
                    </div>
                  )}
                  {booking.discount_amount > 0 && (
                    <div className="flex justify-between text-accent">
                      <dt>{t('detail.discount', { code: booking.promotion_code ?? booking.voucher_code ?? '' })}</dt>
                      <dd>−{formatVnd(booking.discount_amount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <dt>{t('summary.total')}</dt>
                    <dd>{formatVnd(booking.total_price)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {booking.tickets.length > 0 && (
              <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
                <h2 className="mb-3 font-semibold">{t('detail.tickets', { count: booking.tickets.length })}</h2>
                <ul className="flex flex-wrap gap-2">
                  {booking.tickets.map((ticket) => (
                    <li key={ticket.ticket_id}>
                      <Link
                        to={ROUTES.ticketDetail(ticket.ticket_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-sm text-txt no-underline hover:border-accent"
                      >
                        <i className="fa-solid fa-qrcode" aria-hidden="true" />
                        {ticket.seat_code}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              {booking.status === 'PENDING' && booking.payment?.pay_url && (
                <Button
                  type="button"
                  onClick={() => {
                    window.location.href = booking.payment!.pay_url as string;
                  }}
                >
                  <i className="fa-solid fa-wallet mr-2" aria-hidden="true" />
                  {t('detail.continuePayment')}
                </Button>
              )}
              {booking.status === 'PENDING' && (
                <Button type="button" variant="outline" onClick={handleCancel} loading={cancelMutation.isPending}>
                  {t('detail.cancel')}
                </Button>
              )}
              <Link to={ROUTES.myBookings} className="self-center text-sm text-accent no-underline hover:underline">
                {t('detail.myBookings')}
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default GroupBookingDetailPage;
