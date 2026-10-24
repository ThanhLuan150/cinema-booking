import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import { useConfirmGroupBookingPayment } from '../hooks/useGroupBooking';

/**
 * /GroupBooking/PaymentResult — where MoMo sends the browser back. The signed result goes to the
 * server whatever it is (a failure is what releases every seat of the group at once), once; then the
 * customer lands on the group booking's own page.
 */
const GroupBookingPaymentResultPage = () => {
  const { t } = useTranslation('groupBooking');
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = useIsAuthenticated();
  const confirm = useConfirmGroupBookingPayment();
  const params = useMemo(() => Object.fromEntries(new URLSearchParams(location.search)), [location.search]);
  const code = params.orderId ?? '';
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !code || started.current) return;
    started.current = true;
    confirm
      .mutateAsync({ code, params })
      .then((result) => {
        if (result.success) toast.success(t('result.paid'));
        else if (result.refund_pending) toast.error(t('result.refundPending'));
        else toast.error(t('result.failed'));
        navigate(ROUTES.groupBookingDetail(code), { replace: true });
      })
      .catch((err) => setError(getApiErrorMessage(err, t)));
    // `confirm` is a fresh object every render; the ref above is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, code, params]);

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-16 pt-24">
        {!isLoggedIn && <Alert variant="warning">{t('result.loginRequired')}</Alert>}
        {isLoggedIn && !code && <Alert variant="error">{t('result.missing')}</Alert>}
        {isLoggedIn && code && error && (
          <>
            <Alert variant="error">{error}</Alert>
            <Link to={ROUTES.groupBookingDetail(code)} className="text-sm text-accent">
              {t('result.viewBooking')}
            </Link>
          </>
        )}
        {isLoggedIn && code && !error && (
          <div className="flex flex-col items-center gap-3 py-16 text-txt/70">
            <Spinner size="lg" />
            <p>{t('result.processing')}</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GroupBookingPaymentResultPage;
