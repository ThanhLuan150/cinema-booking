import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { BookingSteps } from '../components/BookingSteps';
import { Footer } from '@/components/layout/Footer';
import { PaymentResultPanel } from '../components/PaymentResultPanel';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useConfirmMomoPayment } from '../hooks/useConfirmMomoPayment';
import { setPaymentResult } from '../store/bookingSlice';

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
          <PaymentResultPanel status={paymentStatus} message={paymentMessage} />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentResultPage;
