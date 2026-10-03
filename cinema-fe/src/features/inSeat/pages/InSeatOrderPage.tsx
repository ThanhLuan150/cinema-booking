import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { QrScanner } from '@/features/employee/components/QrScanner';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import { ROUTES } from '@/constants/routes';
import { InSeatLayout } from '../components/InSeatLayout';
import { InSeatLoginPrompt } from '../components/InSeatLoginPrompt';
import { SeatSummary } from '../components/SeatSummary';
import { InSeatMenu } from '../components/InSeatMenu';
import { InSeatStatusBadge } from '../components/InSeatOrderProgress';
import { useCreateInSeatOrder, useInSeatSession } from '../hooks/useInSeat';
import {
  cartCount,
  cartLines,
  cartTotal,
  decrement,
  increment,
  newIdempotencyKey,
  toOrderLines,
  type InSeatCart,
} from '../utils/inSeatCart';
import { extractSeatQr, inSeatPathFor, rememberSeatQr } from '../utils/seatQrLink';
import type { InSeatSession } from '../types/inSeat.types';

function clock(value: string | null, locale: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function ScanStep({ onToken }: { onToken: (token: string) => void }) {
  const { t } = useTranslation('inSeat');
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');

  const accept = (raw: string) => {
    const token = extractSeatQr(raw);
    if (!token) {
      setError(t('scan.invalid'));
      return;
    }
    setError('');
    setCameraOn(false);
    onToken(token);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    accept(manual);
  };

  return (
    <InSeatLayout title={t('pageTitle')}>
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('scan.title')}</h2>
          <p className="text-sm text-txt/70">{t('scan.hint')}</p>
        </div>
        <Button
          type="button"
          variant={cameraOn ? 'secondary' : 'primary'}
          onClick={() => setCameraOn((on) => !on)}
        >
          <i className="fa-solid fa-camera" aria-hidden="true" />
          {cameraOn ? t('scan.stopCamera') : t('scan.startCamera')}
        </Button>
        <QrScanner active={cameraOn} onScan={accept} />
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor="in-seat-manual" className="text-sm text-txt/70">
            {t('scan.manualLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="in-seat-manual"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder={t('scan.manualPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-txt"
            />
            <Button type="submit" variant="outline">
              {t('scan.submit')}
            </Button>
          </div>
        </form>
        {error && <Alert variant="error">{error}</Alert>}
      </section>
    </InSeatLayout>
  );
}

function SeatOrdering({ qr, session }: { qr: string; session: InSeatSession }) {
  const { t, i18n } = useTranslation('inSeat');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [cart, setCart] = useState<InSeatCart>({});
  const [error, setError] = useState('');
  // One key per checkout attempt: a double tap (or a retry after a dropped response) reuses it, so the
  // server returns the same order instead of creating two; changing the cart starts a new attempt.
  const attemptKey = useRef(newIdempotencyKey());
  const createOrder = useCreateInSeatOrder();

  const lines = useMemo(() => cartLines(cart, session.menu), [cart, session.menu]);
  const total = cartTotal(lines);
  const count = cartCount(lines);
  const { ordering } = session;

  const change = (next: InSeatCart) => {
    attemptKey.current = newIdempotencyKey();
    setError('');
    setCart(next);
  };

  const pay = async () => {
    setError('');
    try {
      const result = await createOrder.mutateAsync({
        payload: { qr, items: toOrderLines(lines) },
        idempotencyKey: attemptKey.current,
      });
      if (result.pay_url) window.location.assign(result.pay_url);
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    }
  };

  return (
    <InSeatLayout title={t('pageTitle')}>
      <SeatSummary session={session} />

      {!ordering.open && (
        <Alert variant="warning">
          {ordering.reason === 'IN_SEAT_ORDERING_NOT_OPEN'
            ? t('ordering.notOpen', { time: clock(ordering.opens_at, locale) })
            : t('ordering.closed')}
        </Alert>
      )}
      {ordering.open && ordering.closes_at && (
        <p className="text-xs text-txt/60">
          {t('ordering.closesAt', { time: clock(ordering.closes_at, locale) })}
        </p>
      )}

      {session.orders.length > 0 && (
        <section aria-label={t('orders.title')} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
            {t('orders.title')}
          </h2>
          <ul className="flex flex-col gap-2">
            {session.orders.map((order) => (
              <li key={order.code}>
                <Link
                  to={ROUTES.inSeatOrder(order.code)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm no-underline hover:border-accent/60"
                >
                  <span className="font-semibold text-white">{order.code}</span>
                  <span className="text-txt/70">{formatCurrency(order.total_price)}</span>
                  <InSeatStatusBadge status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <InSeatMenu
        menu={session.menu}
        cart={cart}
        disabled={!ordering.open || createOrder.isPending}
        onIncrement={(id) => change(increment(cart, id))}
        onDecrement={(id) => change(decrement(cart, id))}
      />

      <section
        aria-label={t('cart.title')}
        className="sticky bottom-3 flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface-raised p-4 shadow-raised"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-txt/70">
            {count > 0 ? t('cart.items', { count }) : t('cart.empty')}
          </span>
          <span className="text-lg font-bold text-white" data-testid="in-seat-total">
            {formatCurrency(total)}
          </span>
        </div>
        {count > 0 && <p className="text-xs text-txt/50">{t('cart.totalHint')}</p>}
        {error && <Alert variant="error">{error}</Alert>}
        <Button
          type="button"
          size="lg"
          disabled={!ordering.open || count === 0}
          loading={createOrder.isPending}
          onClick={pay}
        >
          <i className="fa-solid fa-wallet" aria-hidden="true" />
          {createOrder.isPending
            ? t('cart.paying')
            : t('cart.pay', { amount: formatCurrency(total) })}
        </Button>
      </section>
    </InSeatLayout>
  );
}

function SeatSession({ qr }: { qr: string }) {
  const { t } = useTranslation('inSeat');
  const navigate = useNavigate();
  const session = useInSeatSession(qr);

  useEffect(() => {
    if (session.data) rememberSeatQr(qr);
  }, [session.data, qr]);

  if (session.isLoading) {
    return (
      <InSeatLayout title={t('pageTitle')}>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </InSeatLayout>
    );
  }
  if (session.isError || !session.data) {
    return (
      <InSeatLayout title={t('pageTitle')}>
        <Alert variant="error">{getApiErrorMessage(session.error, t)}</Alert>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(ROUTES.inSeat, { replace: true })}
        >
          <i className="fa-solid fa-qrcode" aria-hidden="true" />
          {t('scan.again')}
        </Button>
      </InSeatLayout>
    );
  }
  return <SeatOrdering qr={qr} session={session.data} />;
}

/** /InSeat?qr=<seat token> — scan the seat's QR, pick food and drinks, pay; the kitchen brings it over. */
const InSeatOrderPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoggedIn = useIsAuthenticated();
  const qr = extractSeatQr(searchParams.get('qr'));

  if (!isLoggedIn) return <InSeatLoginPrompt />;
  if (!qr)
    return <ScanStep onToken={(token) => navigate(inSeatPathFor(token), { replace: true })} />;
  return <SeatSession key={qr} qr={qr} />;
};

export default InSeatOrderPage;
