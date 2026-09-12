import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { CASHIER_SHIFT_STATUS, CASHIER_SHIFT_STATUS_META } from '@/constants/cashierShiftStatus';
import type { CashierShift } from '../types/cashierShift.types';
import { money, DifferenceValue } from '../utils/format';

export function CashierShiftsTable({
  shifts,
  canClose,
  page,
  totalPages,
  onPageChange,
  onClose,
}: {
  shifts: CashierShift[];
  canClose: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClose: (shiftId: number) => void;
}) {
  const { t } = useTranslation('cashierShift');
  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('headers.id'),
          t('headers.employee'),
          t('headers.openedAt'),
          t('headers.closedAt'),
          t('headers.openingCash'),
          t('headers.expectedCash'),
          t('headers.actualCash'),
          t('headers.difference'),
          t('headers.status'),
          t('headers.actions'),
        ]}
      >
        {shifts.map((shift) => {
          const meta = CASHIER_SHIFT_STATUS_META[shift.status];
          return (
            <tr key={shift.id}>
              <td>{shift.id}</td>
              <td>#{shift.employee_id}</td>
              <td className="whitespace-nowrap text-sm">{new Date(shift.opened_at).toLocaleString()}</td>
              <td className="whitespace-nowrap text-sm">
                {shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '—'}
              </td>
              <td>{money(shift.opening_cash)}</td>
              <td>{money(shift.expected_cash)}</td>
              <td>{money(shift.actual_cash)}</td>
              <td>
                <DifferenceValue value={shift.difference} />
              </td>
              <td>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', meta?.className)}>
                  {t(`status.${meta?.key ?? 'open'}`)}
                </span>
              </td>
              <td>
                {canClose && shift.status === CASHIER_SHIFT_STATUS.open && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => onClose(shift.id)}
                  >
                    {t('currentShift.closeButton')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
