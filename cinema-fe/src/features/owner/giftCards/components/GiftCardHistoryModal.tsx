import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { GiftCardTransaction } from '@/types/entities';

interface GiftCardHistoryModalProps {
  history: { data: GiftCardTransaction[]; totalPages: number } | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

export function GiftCardHistoryModal({ history, isLoading, page, onPageChange, onClose }: GiftCardHistoryModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('giftCards.historyTitle')}>
      <DataTable
        headers={[
          t('giftCards.headers.date'),
          t('giftCards.headers.type'),
          t('giftCards.headers.amount'),
          t('giftCards.headers.balanceAfter'),
        ]}
      >
        {(history?.data ?? []).map((row) => (
          <tr key={row.id}>
            <td>{new Date(row.createdAt).toLocaleString()}</td>
            <td>{t(`giftCards.historyType.${row.type}`)}</td>
            <td>{row.amount.toLocaleString()}đ</td>
            <td>{row.balance_after.toLocaleString()}đ</td>
          </tr>
        ))}
      </DataTable>
      {!isLoading && (history?.data.length ?? 0) === 0 && (
        <EmptyState title={t('giftCards.historyEmpty')} icon="fa-solid fa-clock-rotate-left" />
      )}
      <Pagination page={page} totalPages={history?.totalPages ?? 1} onPageChange={onPageChange} />
    </Modal>
  );
}
