import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { PAYMENT_STATUS_META, PAYMENT_TYPE_META } from '@/constants/paymentStatus';
import type { Payment } from '../types/payment.types';

interface PaymentCardProps {
  payment: Payment;
}

export function PaymentCard({ payment }: PaymentCardProps) {
  const { t } = useTranslation('payment');
  const status = PAYMENT_STATUS_META[payment.status];
  const type = PAYMENT_TYPE_META[payment.type];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-white">{payment.code}</p>
        <p className="text-sm text-txt/70">
          {t(`history.type.${type?.key ?? 'online'}`)} ·{' '}
          {new Date(payment.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-white">{payment.amount.toLocaleString()}đ</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            status?.className,
          )}
        >
          {t(`history.status.${status?.key ?? 'pending'}`)}
        </span>
      </div>
    </div>
  );
}
