import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/hooks/usePermissions';
import { REFUND_STATUS, REFUND_STATUS_META } from '@/constants/refundStatus';
import type { Refund } from '@/features/refund/types/refund.types';

export interface ListItemProps {
  refund: Refund;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onProcess: (id: number) => void;
  onComplete: (id: number) => void;
  onFail: (id: number) => void;
}

export const ListItem = ({ refund, onApprove, onReject, onProcess, onComplete, onFail }: ListItemProps) => {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const status = REFUND_STATUS_META[refund.status];

  return (
    <tr>
      <td>{refund.id}</td>
      <td>{refund.booking_id}</td>
      <td>{refund.amount.toLocaleString()}đ</td>
      <td>{refund.policy_percent}%</td>
      <td>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', status?.className)}>
          {t(`refunds.status.${status?.key ?? 'requested'}`)}
        </span>
      </td>
      <td>
        <div className="flex flex-wrap gap-3">
          {hasPermission('refund.approve') && refund.status === REFUND_STATUS.requested && (
            <>
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onApprove(refund.id)}
              >
                {t('refunds.approveButton')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                onClick={() => onReject(refund.id)}
              >
                {t('refunds.rejectButton')}
              </button>
            </>
          )}
          {hasPermission('refund.process') && refund.status === REFUND_STATUS.approved && (
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onProcess(refund.id)}
            >
              {t('refunds.processButton')}
            </button>
          )}
          {hasPermission('refund.process') && refund.status === REFUND_STATUS.processing && (
            <>
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onComplete(refund.id)}
              >
                {t('refunds.completeButton')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                onClick={() => onFail(refund.id)}
              >
                {t('refunds.failButton')}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
