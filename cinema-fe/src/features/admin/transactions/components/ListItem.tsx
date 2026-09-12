import { useTranslation } from 'react-i18next';
import { INVOICE_STATUS, INVOICE_STATUS_META } from '@/constants/invoiceStatus';
import type { AdminInvoice } from '../types/adminTransaction.types';

export interface ListItemProps {
  invoice: AdminInvoice;
  onRefund: (id: number) => void;
}

export const ListItem = ({ invoice, onRefund }: ListItemProps) => {
  const { t } = useTranslation('admin');
  const status = INVOICE_STATUS_META[invoice.status] || INVOICE_STATUS_META[INVOICE_STATUS.booked];

  return (
    <tr>
      <td>{invoice.id}</td>
      <td>{invoice.code}</td>
      <td>{invoice.account?.email}</td>
      <td>{invoice.movie?.name}</td>
      <td>{invoice.ticket?.seat_code}</td>
      <td>{invoice.total_price.toLocaleString()}đ</td>
      <td>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${status.className}`}>
          {t(`transactions.status.${status.key}`)}
        </span>
      </td>
      <td>
        {invoice.status === INVOICE_STATUS.booked && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onRefund(invoice.id)}
          >
            {t('transactions.refundButton')}
          </button>
        )}
      </td>
    </tr>
  );
};
