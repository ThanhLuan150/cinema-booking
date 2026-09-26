import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { Inventory } from '@/types/entities';
import { DeleteInventoryButton } from './DeleteInventoryButton';
import { STATUS_VARIANT, STATUS_LABEL_KEY, isLowStock } from '../constants';

interface InventoryTableProps {
  items: Inventory[];
  cinemaNameById: Map<number, string>;
  comboNameById: Map<number, string>;
  // Stock changes, edits and deletion need inventory.manage; a Position that only holds
  // inventory.view (Concession/F&B Staff) sees the table and the history but none of the write actions.
  canManage: boolean;
  onImport: (id: number) => void;
  onReturn: (id: number) => void;
  onAdjust: (id: number) => void;
  onWaste: (id: number) => void;
  onEdit: (id: number) => void;
  onHistory: (id: number) => void;
}

const ACTION_CLASS = 'text-sm font-medium text-accent transition-colors hover:text-accent-hover';

const formatMoney = (value: number | undefined) => (value ? value.toLocaleString() : '—');

export function InventoryTable({
  items,
  cinemaNameById,
  comboNameById,
  canManage,
  onImport,
  onReturn,
  onAdjust,
  onWaste,
  onEdit,
  onHistory,
}: InventoryTableProps) {
  const { t } = useTranslation('owner');

  return (
    <DataTable
      headers={[
        t('inventory.headers.id'),
        t('inventory.headers.cinema'),
        t('inventory.headers.item'),
        t('inventory.headers.category'),
        t('inventory.headers.combo'),
        t('inventory.headers.quantity'),
        t('inventory.headers.minQuantity'),
        t('inventory.headers.unit'),
        t('inventory.headers.costPrice'),
        t('inventory.headers.sellingPrice'),
        t('inventory.headers.status'),
        t('inventory.headers.actions'),
      ]}
    >
      {items.map((item) => (
        <tr key={item.id}>
          <td>{item.id}</td>
          <td>{cinemaNameById.get(item.branch_id) || item.branch_id}</td>
          <td>
            {item.item}
            {item.sku && <div className="text-xs text-txt/50">{item.sku}</div>}
          </td>
          <td>{item.category || t('inventory.notLinked')}</td>
          <td>{item.combo_id ? comboNameById.get(item.combo_id) || item.combo_id : t('inventory.notLinked')}</td>
          <td className={isLowStock(item.status) ? 'font-semibold text-amber-300' : undefined}>{item.quantity}</td>
          <td>{item.minimum_quantity}</td>
          <td>{item.unit}</td>
          <td>{formatMoney(item.cost_price)}</td>
          <td>{formatMoney(item.selling_price)}</td>
          <td>
            <Badge variant={STATUS_VARIANT[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Badge>
          </td>
          <td>
            <div className="flex min-w-[15rem] flex-wrap gap-x-3 gap-y-1">
              {canManage && (
                <>
                  <button type="button" className={ACTION_CLASS} onClick={() => onImport(item.id)}>
                    {t('inventory.import')}
                  </button>
                  <button type="button" className={ACTION_CLASS} onClick={() => onReturn(item.id)}>
                    {t('inventory.return')}
                  </button>
                  <button type="button" className={ACTION_CLASS} onClick={() => onAdjust(item.id)}>
                    {t('inventory.adjust')}
                  </button>
                  <button type="button" className={ACTION_CLASS} onClick={() => onWaste(item.id)}>
                    {t('inventory.waste')}
                  </button>
                  <button type="button" className={ACTION_CLASS} onClick={() => onEdit(item.id)}>
                    {t('inventory.edit')}
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                onClick={() => onHistory(item.id)}
              >
                {t('inventory.historyButton')}
              </button>
              {canManage && <DeleteInventoryButton id={item.id} />}
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
