import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import type { Holiday } from '@/types/entities';
import { ALL_BRANCHES } from '../constants';

interface HolidayTableProps {
  holidays: Holiday[];
  branchNameById: Map<number, string>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: number) => void;
}

export function HolidayTable({ holidays, branchNameById, page, totalPages, onPageChange, onDelete }: HolidayTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('holidays.headers.id'),
          t('holidays.headers.date'),
          t('holidays.headers.name'),
          t('holidays.headers.branch'),
          t('holidays.headers.actions'),
        ]}
      >
        {holidays.map((holiday) => (
          <tr key={holiday.id}>
            <td>{holiday.id}</td>
            <td>{holiday.date}</td>
            <td>{holiday.name}</td>
            <td>
              {holiday.branch_id === null
                ? t('holidays.allBranchesOption')
                : branchNameById.get(holiday.branch_id) || holiday.branch_id}
            </td>
            <td>
              <button
                type="button"
                className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                onClick={() => onDelete(holiday.id)}
              >
                {t('holidays.delete')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
