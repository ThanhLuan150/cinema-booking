import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { Inventory } from '@/types/entities';
import { DeleteInventoryButton } from './DeleteInventoryButton';
import { STATUS_VARIANT, STATUS_LABEL_KEY } from '../constants';

interface InventoryTableProps {
  items: Inventory[];
  cinemaNameById: Map<number, string>;
  comboNameById: Map<number, string>;
  onReceive: (id: number) => void;
  onAdjust: (id: number) => void;
  onDeduct: (id: number) => void;
  onHistory: (id: number) => void;
}

export function InventoryTable({
  items,
  cinemaNameById,
  comboNameById,
  onReceive,
  onAdjust,
  onDeduct,
  onHistory,
}: InventoryTableProps) {
  const { t } = useTranslation('owner');

  return (
    <DataTable
      headers={[
        t('inventory.headers.id'),
        t('inventory.headers.cinema'),
        t('inventory.headers.item'),
        t('inventory.headers.combo'),
        t('inventory.headers.quantity'),
        t('inventory.headers.minQuantity'),
        t('inventory.headers.unit'),
        t('inventory.headers.status'),
        t('inventory.headers.actions'),
      ]}
    >
      {items.map((item) => (
        <tr key={item.id}>
          <td>{item.id}</td>
          <td>{cinemaNameById.get(item.branch_id) || item.branch_id}</td>
          <td>{item.item}</td>
          <td>{item.combo_id ? comboNameById.get(item.combo_id) || item.combo_id : t('inventory.notLinked')}</td>
          <td>{item.quantity}</td>
          <td>{item.minimum_quantity}</td>
          <td>{item.unit}</td>
          <td>
            <Badge variant={STATUS_VARIANT[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Badge>
          </td>
          <td className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onReceive(item.id)}
            >
              {t('inventory.receive')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onAdjust(item.id)}
            >
              {t('inventory.adjust')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onDeduct(item.id)}
            >
              {t('inventory.deduct')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
              onClick={() => onHistory(item.id)}
            >
              {t('inventory.historyButton')}
            </button>
            <DeleteInventoryButton id={item.id} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
