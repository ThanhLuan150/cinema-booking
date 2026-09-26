import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import type { Attendance } from '@/types/entities';
import { STATUS_VARIANT } from '../constants';
import { formatClock, formatMinutes } from '../utils/format';

interface AttendanceTableProps {
  records: Attendance[];
  // A manager's table names the employee (and, across branches, the branch); an employee's own
  // history does not need to.
  showEmployee?: boolean;
  showBranch?: boolean;
  onCloseSession?: (record: Attendance) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AttendanceTable({
  records,
  showEmployee = false,
  showBranch = false,
  onCloseSession,
  page,
  totalPages,
  onPageChange,
}: AttendanceTableProps) {
  const { t } = useTranslation('attendance');

  const headers = [
    t('table.date'),
    ...(showEmployee ? [t('table.employee')] : []),
    ...(showBranch ? [t('table.branch')] : []),
    t('table.clockIn'),
    t('table.break'),
    t('table.clockOut'),
    t('table.worked'),
    t('table.status'),
    t('table.note'),
    ...(onCloseSession ? [t('table.actions')] : []),
  ];

  return (
    <>
      <DataTable headers={headers} emptyMessage={t('table.empty')}>
        {records.map((record) => {
          const { timezone } = record;
          const open = record.session_state === 'WORKING' || record.session_state === 'ON_BREAK';
          return (
            <tr key={record.id}>
              <td className="whitespace-nowrap">{record.work_date}</td>
              {showEmployee && (
                <td>
                  <div className="font-medium">{record.employee?.name || record.employee?.employee_code || `#${record.employee_id}`}</div>
                  {record.employee?.name && (
                    <div className="font-mono text-xs text-txt/50">{record.employee.employee_code}</div>
                  )}
                </td>
              )}
              {showBranch && <td>#{record.branch_id}</td>}
              <td className="tabular-nums">{formatClock(record.clock_in, timezone)}</td>
              <td className="whitespace-nowrap tabular-nums">
                {record.break_start
                  ? `${formatClock(record.break_start, timezone)} – ${formatClock(record.break_end, timezone)}`
                  : '—'}
              </td>
              <td className="tabular-nums">
                {open ? <span className="text-amber-400">{t(`sessionState.${record.session_state}`)}</span> : formatClock(record.clock_out, timezone)}
              </td>
              <td className="tabular-nums">{record.clock_in ? formatMinutes(record.worked_minutes) : '—'}</td>
              <td>
                <Badge variant={STATUS_VARIANT[record.status]}>{t(`status.${record.status}`)}</Badge>
              </td>
              <td className="max-w-[16rem] truncate text-sm text-txt/70" title={record.note ?? undefined}>
                {record.note || '—'}
              </td>
              {onCloseSession && (
                <td>
                  {open && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => onCloseSession(record)}
                    >
                      {t('table.closeSession')}
                    </button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
