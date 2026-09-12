import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useInventoryHistory } from '../../hooks/useInventoryHistory';
import { HISTORY_TYPE_LABEL_KEY } from '../constants';

interface HistoryModalProps {
  itemId: number;
  onClose: () => void;
}

export function HistoryModal({ itemId, onClose }: HistoryModalProps) {
  const { t } = useTranslation('owner');
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData } = useInventoryHistory(itemId, historyPage, DEFAULT_PAGE_SIZE);

  return (
    <Modal open onClose={onClose} title={t('inventory.history.title')} className="max-w-2xl">
      <DataTable
        headers={[
          t('inventory.history.headers.date'),
          t('inventory.history.headers.type'),
          t('inventory.history.headers.change'),
          t('inventory.history.headers.before'),
          t('inventory.history.headers.after'),
          t('inventory.history.headers.reason'),
        ]}
        emptyMessage={t('inventory.history.empty')}
      >
        {(historyData?.data ?? []).map((tx) => (
          <tr key={tx.id}>
            <td>{new Date(tx.createdAt).toLocaleString()}</td>
            <td>{t(HISTORY_TYPE_LABEL_KEY[tx.type])}</td>
            <td>
              {tx.quantity_change > 0 ? '+' : ''}
              {tx.quantity_change}
            </td>
            <td>{tx.quantity_before}</td>
            <td>{tx.quantity_after}</td>
            <td>{tx.reason || t('inventory.notLinked')}</td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={historyPage} totalPages={historyData?.totalPages ?? 1} onPageChange={setHistoryPage} />
    </Modal>
  );
}
