import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Cinema, Combo } from '@/types/entities';
import { COMBO_TYPE_LABEL_KEY } from '../constants';

interface ComboTableProps {
  combos: Combo[];
  cinemas: Cinema[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleActive: (combo: Combo) => void;
  onDelete: (comboId: number) => void;
}

export function ComboTable({ combos, cinemas, page, totalPages, onPageChange, onToggleActive, onDelete }: ComboTableProps) {
  const { t } = useTranslation('owner');
  const cinemaNameById = new Map(cinemas.map((c) => [c.id, c.name]));

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('combos.headers.id'),
          t('combos.headers.cinema'),
          t('combos.headers.name'),
          t('combos.headers.type'),
          t('combos.headers.price'),
          t('combos.headers.status'),
          t('combos.headers.actions'),
        ]}
      >
        {combos.map((combo) => (
          <tr key={combo.id}>
            <td>{combo.id}</td>
            <td>{cinemaNameById.get(combo.cinema_id) || combo.cinema_id}</td>
            <td>{combo.name}</td>
            <td>{t(COMBO_TYPE_LABEL_KEY[combo.type] ?? COMBO_TYPE_LABEL_KEY.COMBO)}</td>
            <td>{combo.price.toLocaleString()}đ</td>
            <td>
              <Badge variant={combo.active ? 'success' : 'default'}>
                {combo.active ? t('combos.statusActive') : t('combos.statusInactive')}
              </Badge>
            </td>
            <td className="flex gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onToggleActive(combo)}
              >
                {combo.active ? t('combos.deactivate') : t('combos.activate')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                onClick={() => onDelete(combo.id)}
              >
                {t('combos.delete')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
