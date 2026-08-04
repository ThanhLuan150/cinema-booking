import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BookingSteps } from '../components/BookingSteps';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useConfirmMomoPayment } from '../hooks/useConfirmMomoPayment';
import { setPaymentResult } from '../store/bookingSlice';
import { ROUTES } from '@/constants/routes';

const PaymentResultPage = () => {
  const { t } = useTranslation('payment');
  const dispatch = useAppDispatch();
  const { paymentStatus, paymentMessage } = useAppSelector((state) => state.booking);
  const isLoggedIn = useIsAuthenticated();
  const confirmMomoPaymentMutation = useConfirmMomoPayment();

  useEffect(() => {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));

    if (!isLoggedIn) {
      dispatch(setPaymentResult({ status: 'failed', message: t('notLoggedIn') }));
      return;
    }

    if (String(params.resultCode) !== '0') {
      dispatch(
        setPaymentResult({ status: 'failed', message: params.message || t('genericFailed') }),
      );
      return;
    }

    confirmMomoPaymentMutation
      .mutateAsync(params)
      .then(() => {
        dispatch(setPaymentResult({ status: 'success', message: t('success.message') }));
      })
      .catch((error) => {
        dispatch(
          setPaymentResult({
            status: 'failed',
            message: getApiErrorMessage(error, t) || t('failed.confirmFailed'),
          }),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex flex-1 flex-col px-4 pt-20">
        <BookingSteps current={4} />
        <div className="flex flex-1 items-center justify-center pb-16">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-raised">
            {paymentStatus === 'confirming' && (
              <>
                <div className="flex justify-center">
                  <Spinner size="lg" />
                </div>
                <p className="mt-4 text-txt/70">{t('confirming')}</p>
              </>
            )}
            {paymentStatus === 'success' && (
              <>
                <i className="fa-solid fa-circle-check text-5xl text-emerald-500" />
                <h2 className="mt-4 text-xl font-semibold text-white">{t('success.title')}</h2>
                <p className="mt-2 text-txt/70">{paymentMessage}</p>
                <Link to={ROUTES.myBookings} className="mt-6 inline-block no-underline">
                  <Button type="button">{t('success.viewBookings')}</Button>
                </Link>
              </>
            )}
            {paymentStatus === 'failed' && (
              <>
                <i className="fa-solid fa-circle-xmark text-5xl text-red-500" />
                <h2 className="mt-4 text-xl font-semibold text-white">{t('failed.title')}</h2>
                <p className="mt-2 text-txt/70">{paymentMessage}</p>
                <Link to={ROUTES.home} className="mt-6 inline-block no-underline">
                  <Button type="button" variant="secondary">
                    {t('failed.backHome')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentResultPage;
