import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/constants/routes';
import { InSeatLayout } from '../components/InSeatLayout';
import { InSeatLoginPrompt } from '../components/InSeatLoginPrompt';
import { InSeatOrderProgress, InSeatStatusBadge } from '../components/InSeatOrderProgress';
import { useInSeatOrder } from '../hooks/useInSeat';
import { inSeatPathFor, lastSeatQr } from '../utils/seatQrLink';
import type { InSeatOrder } from '../types/inSeat.types';

function StatusMessage({ order }: { order: InSeatOrder }) {
  const { t } = useTranslation('inSeat');
  if (order.status === 'PENDING') {
    return (
      <Alert variant="warning">
        <p>{order.pay_url ? t('track.awaitingPayment') : t('track.paymentExpired')}</p>
        {order.pay_url && (
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => window.location.assign(order.pay_url as string)}
          >
            {t('track.continuePayment')}
          </Button>
        )}
      </Alert>
    );
  }
  if (order.status === 'CANCELLED') {
    const paymentStatus = order.payment?.status;
    return (
      <Alert variant="error">
        <p>{t('track.cancelled')}</p>
        {order.cancel_reason && (
          <p className="mt-1">{t('track.reason', { reason: order.cancel_reason })}</p>
        )}
        {paymentStatus === 'REFUND_PENDING' && <p className="mt-1">{t('track.refundPending')}</p>}
        {paymentStatus === 'REFUNDED' && <p className="mt-1">{t('track.refunded')}</p>}
      </Alert>
    );
  }
  return <p className="text-center text-sm text-txt/80">{t(`track.message.${order.status}`)}</p>;
}

/** /InSeat/Orders/:code — live progress of one in-seat order, from payment to the seat. */
const InSeatOrderTrackingPage = () => {
  const { t } = useTranslation('inSeat');
  const navigate = useNavigate();
  const { code } = useParams();
  const isLoggedIn = useIsAuthenticated();
  const query = useInSeatOrder(isLoggedIn ? code : undefined);

  if (!isLoggedIn) return <InSeatLoginPrompt />;

  const seatQr = lastSeatQr();
  const backToSeat = (
    <Button
      type="button"
      variant="outline"
      onClick={() => navigate(seatQr ? inSeatPathFor(seatQr) : ROUTES.inSeat)}
    >
      <i className={seatQr ? 'fa-solid fa-utensils' : 'fa-solid fa-qrcode'} aria-hidden="true" />
      {seatQr ? t('track.orderMore') : t('track.scanSeat')}
    </Button>
  );

  if (query.isLoading) {
    return (
      <InSeatLayout title={t('pageTitle')}>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </InSeatLayout>
    );
  }
  const order = query.data;
  if (query.isError || !order) {
    return (
      <InSeatLayout title={t('pageTitle')}>
        <Alert variant="error">{t('track.notFound')}</Alert>
        {backToSeat}
      </InSeatLayout>
    );
  }

  return (
    <InSeatLayout title={t('track.title', { code: order.code })}>
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            {order.seat && (
              <p className="text-base font-semibold text-white">
                {t('track.deliverTo', { seat: order.seat.code, room: order.seat.room ?? '' })}
              </p>
            )}
            {order.seat?.showtime.time && (
              <p className="text-xs text-txt/60">
                {t('track.showtime', { time: order.seat.showtime.time })}
              </p>
            )}
          </div>
          <InSeatStatusBadge status={order.status} />
        </div>
        <InSeatOrderProgress order={order} />
        <StatusMessage order={order} />
      </section>

      <section
        aria-label={t('track.items')}
        className="rounded-2xl border border-border bg-surface p-5 shadow-card"
      >
        <ul className="flex flex-col gap-2 text-sm">
          {order.items.map((item) => (
            <li key={item.combo_id} className="flex items-baseline justify-between gap-3">
              <span>
                <span className="mr-2 font-bold tabular-nums">{item.quantity}×</span>
                {item.name}
              </span>
              <span className="tabular-nums text-txt/80">{formatCurrency(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm text-txt/70">{t('track.total')}</span>
          <span className="text-lg font-bold text-white">{formatCurrency(order.total_price)}</span>
        </div>
        {order.payment && (
          <p className="mt-1 text-right text-xs text-txt/50">
            {t('track.paidWith', {
              method: order.payment.method,
              status: t(`track.paymentStatus.${order.payment.status}`),
            })}
          </p>
        )}
      </section>

      {backToSeat}
    </InSeatLayout>
  );
};

export default InSeatOrderTrackingPage;
