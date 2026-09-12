import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import type { PaymentStatus } from '../types/booking.types';

export function PaymentResultPanel({ status, message }: { status: PaymentStatus; message: string | null }) {
  const { t } = useTranslation('payment');

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-raised">
      {status === 'confirming' && (
        <>
          <div className="flex justify-center">
            <Spinner size="lg" />
          </div>
          <p className="mt-4 text-txt/70">{t('confirming')}</p>
        </>
      )}
      {status === 'success' && (
        <>
          <i className="fa-solid fa-circle-check text-5xl text-emerald-500" />
          <h2 className="mt-4 text-xl font-semibold text-white">{t('success.title')}</h2>
          <p className="mt-2 text-txt/70">{message}</p>
          <Link to={ROUTES.myBookings} className="mt-6 inline-block no-underline">
            <Button type="button">{t('success.viewBookings')}</Button>
          </Link>
        </>
      )}
      {status === 'failed' && (
        <>
          <i className="fa-solid fa-circle-xmark text-5xl text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-white">{t('failed.title')}</h2>
          <p className="mt-2 text-txt/70">{message}</p>
          <Link to={ROUTES.home} className="mt-6 inline-block no-underline">
            <Button type="button" variant="secondary">
              {t('failed.backHome')}
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
