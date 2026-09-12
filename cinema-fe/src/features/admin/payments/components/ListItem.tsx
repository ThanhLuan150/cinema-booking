import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { PAYMENT_STATUS, PAYMENT_STATUS_META, PAYMENT_TYPE_META } from '@/constants/paymentStatus';
import type { Payment } from '@/features/payment/types/payment.types';

export interface ListItemProps {
  payment: Payment;
  onRequestRefund: (id: number) => void;
  onConfirmRefund: (id: number) => void;
}

export const ListItem = ({ payment, onRequestRefund, onConfirmRefund }: ListItemProps) => {
  const { t } = useTranslation('admin');
  const status = PAYMENT_STATUS_META[payment.status];
  const type = PAYMENT_TYPE_META[payment.type];

  return (
    <tr>
      <td>{payment.id}</td>
      <td>{payment.code}</td>
      <td>{t(`payments.type.${type?.key ?? 'online'}`)}</td>
      <td>{payment.amount.toLocaleString()}đ</td>
      <td>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', status?.className)}>
          {t(`payments.status.${status?.key ?? 'pending'}`)}
        </span>
      </td>
      <td>
        {payment.status === PAYMENT_STATUS.paid && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onRequestRefund(payment.id)}
          >
            {t('payments.requestRefundButton')}
          </button>
        )}
        {payment.status === PAYMENT_STATUS.refundPending && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onConfirmRefund(payment.id)}
          >
            {t('payments.confirmRefundButton')}
          </button>
        )}
      </td>
    </tr>
  );
};
