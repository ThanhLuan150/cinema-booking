import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/format';
import { ROUTES } from '@/constants/routes';
import { useConfirmSubscriptionPayment } from '../hooks/useSubscriptions';
import type { SubscriptionConfirmResult } from '../types/membership.types';

/**
 * /Membership/PaymentResult — where MoMo sends the browser back after paying for a subscription. The
 * signed result goes to the server once; only the server activates anything (MoMo's IPN may already
 * have), this page just reports what happened.
 */
function SubscriptionPaymentResultPage() {
  const { t } = useTranslation('membership');
  const location = useLocation();
  const isLoggedIn = useIsAuthenticated();
  const confirm = useConfirmSubscriptionPayment();
  const params = useMemo(() => Object.fromEntries(new URLSearchParams(location.search)), [location.search]);
  const code = params.orderId ?? '';
  const [result, setResult] = useState<SubscriptionConfirmResult | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !code || started.current) return;
    started.current = true;
    confirm
      .mutateAsync({ code, params })
      .then(setResult)
      .catch((err) => setError(getApiErrorMessage(err, t)));
    // `confirm` is a fresh object every render; the ref above is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, code, params]);

  const active = result?.subscription?.status === 'ACTIVE' ? result.subscription : null;

  return (
    <AccountLayout title={t('paymentResult.title')}>
      {!isLoggedIn && <Alert variant="error">{t('paymentResult.notLoggedIn')}</Alert>}
      {isLoggedIn && !code && <Alert variant="error">{t('paymentResult.missing')}</Alert>}
      {isLoggedIn && code && !result && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-txt/70">
          <Spinner size="lg" />
          <p>{t('paymentResult.processing')}</p>
        </div>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {active && active.end_at && (
        <Alert variant="success">
          {t('paymentResult.activated', { plan: active.plan.name, until: formatDate(active.end_at) })}
        </Alert>
      )}
      {result && result.refundPending && <Alert variant="warning">{t('paymentResult.refundPending')}</Alert>}
      {(result || error) && (
        <Link to={ROUTES.myMembership} className="mt-6 inline-block text-sm text-accent">
          {t('paymentResult.backToMembership')}
        </Link>
      )}
    </AccountLayout>
  );
}

export default SubscriptionPaymentResultPage;
