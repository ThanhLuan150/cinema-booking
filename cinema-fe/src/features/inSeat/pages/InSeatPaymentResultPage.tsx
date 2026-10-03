import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import { InSeatLayout } from '../components/InSeatLayout';
import { InSeatLoginPrompt } from '../components/InSeatLoginPrompt';
import { useConfirmInSeatPayment } from '../hooks/useInSeat';

/**
 * /InSeat/PaymentResult — where MoMo sends the browser back. The signed result goes to the server once
 * (it is idempotent, and MoMo's server-to-server IPN may have applied it already), then the customer
 * lands on the order's live tracking page whatever the outcome.
 */
const InSeatPaymentResultPage = () => {
  const { t } = useTranslation('inSeat');
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = useIsAuthenticated();
  const confirm = useConfirmInSeatPayment();
  const params = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search)),
    [location.search],
  );
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
        else toast.error(t('result.notPaid'));
        navigate(ROUTES.inSeatOrder(code), { replace: true });
      })
      .catch((err) => setError(getApiErrorMessage(err, t)));
    // `confirm` is a fresh object every render; the ref above is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, code, params]);

  if (!isLoggedIn) return <InSeatLoginPrompt />;

  return (
    <InSeatLayout title={t('pageTitle')}>
      {!code && <Alert variant="error">{t('result.missing')}</Alert>}
      {code && error && (
        <>
          <Alert variant="error">{error}</Alert>
          <Link to={ROUTES.inSeatOrder(code)} className="text-sm text-accent">
            {t('result.viewOrder')}
          </Link>
        </>
      )}
      {code && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-txt/70">
          <Spinner size="lg" />
          <p>{t('result.processing')}</p>
        </div>
      )}
    </InSeatLayout>
  );
};

export default InSeatPaymentResultPage;
