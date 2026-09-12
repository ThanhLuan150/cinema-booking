import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useGiftCardHistory } from '../hooks/useGiftCardHistory';

export function GiftCardHistoryModal({ cardId, onClose }: { cardId: number; onClose: () => void }) {
  const { t } = useTranslation('giftCards');
  const [historyPage, setHistoryPage] = useState(1);
  const { data: history, isLoading: historyLoading } = useGiftCardHistory(cardId, historyPage, DEFAULT_PAGE_SIZE);

  return (
    <Modal open onClose={onClose} title={t('history.title')}>
      <DataTable headers={[t('history.date'), t('history.type'), t('history.amount'), t('history.balanceAfter')]}>
        {(history?.data ?? []).map((row) => (
          <tr key={row.id}>
            <td>{new Date(row.createdAt).toLocaleString()}</td>
            <td>{t(`historyType.${row.type}`)}</td>
            <td>{row.amount.toLocaleString()}</td>
            <td>{row.balance_after.toLocaleString()}</td>
          </tr>
        ))}
      </DataTable>
      {!historyLoading && (history?.data.length ?? 0) === 0 && (
        <EmptyState title={t('history.empty')} icon="fa-solid fa-clock-rotate-left" />
      )}
      <Pagination page={historyPage} totalPages={history?.totalPages ?? 1} onPageChange={setHistoryPage} />
    </Modal>
  );
}
