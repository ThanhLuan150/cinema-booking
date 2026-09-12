import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useVoucherHistory } from '../hooks/useVoucherHistory';

interface VoucherHistoryModalProps {
  voucherId: number;
  page: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

export function VoucherHistoryModal({ voucherId, page, onPageChange, onClose }: VoucherHistoryModalProps) {
  const { t } = useTranslation('owner');
  const { data: history, isLoading: historyLoading } = useVoucherHistory(voucherId, page, DEFAULT_PAGE_SIZE);

  return (
    <Modal open onClose={onClose} title={t('vouchers.historyTitle')}>
      <DataTable headers={[t('vouchers.headers.date'), t('vouchers.headers.account'), t('vouchers.headers.discountAmount')]}>
        {(history?.data ?? []).map((row) => (
          <tr key={row.id}>
            <td>{new Date(row.createdAt).toLocaleString()}</td>
            <td>#{row.account_id}</td>
            <td>{row.discount_amount.toLocaleString()}đ</td>
          </tr>
        ))}
      </DataTable>
      {!historyLoading && (history?.data.length ?? 0) === 0 && (
        <EmptyState title={t('vouchers.historyEmpty')} icon="fa-solid fa-clock-rotate-left" />
      )}
      <Pagination page={page} totalPages={history?.totalPages ?? 1} onPageChange={onPageChange} />
    </Modal>
  );
}
