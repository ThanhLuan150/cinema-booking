import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Shift } from '@/types/entities';

interface ShiftTableProps {
  shifts: Shift[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (shiftId: number) => void;
  onToggleStatus: (shift: Shift) => void;
  onDelete: (shiftId: number) => void;
}

export function ShiftTable({
  shifts,
  page,
  totalPages,
  onPageChange,
  canUpdate,
  canDelete,
  onEdit,
  onToggleStatus,
  onDelete,
}: ShiftTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('shifts.headers.id'),
          t('shifts.headers.name'),
          t('shifts.headers.time'),
          t('shifts.headers.status'),
          t('shifts.headers.actions'),
        ]}
      >
        {shifts.map((shift) => (
          <tr key={shift.id}>
            <td>{shift.id}</td>
            <td>{shift.name}</td>
            <td>
              {shift.start_time} - {shift.end_time}
            </td>
            <td>
              <Badge variant={shift.status === 'ACTIVE' ? 'success' : 'default'}>
                {shift.status === 'ACTIVE' ? t('shifts.statusActive') : t('shifts.statusInactive')}
              </Badge>
            </td>
            <td>
              <div className="flex flex-wrap gap-3">
                {canUpdate && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => onEdit(shift.id)}
                  >
                    {t('shifts.edit')}
                  </button>
                )}
                {canUpdate && (
                  <button
                    type="button"
                    className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                    onClick={() => onToggleStatus(shift)}
                  >
                    {shift.status === 'ACTIVE' ? t('shifts.deactivate') : t('shifts.activate')}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => onDelete(shift.id)}
                  >
                    {t('shifts.delete')}
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
