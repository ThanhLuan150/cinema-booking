import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useMyShiftAssignments } from '../hooks/useMyShiftAssignments';

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function MySchedule() {
  const { t } = useTranslation('employee');
  const { data, isLoading } = useMyShiftAssignments();
  const assignments = useMemo(() => data?.data ?? [], [data]);

  return (
    <AdminLayout breadcrumb={t('mySchedule.breadcrumb')} loading={isLoading}>
      {assignments.length === 0 ? (
        <EmptyState title={t('mySchedule.emptyTitle')} />
      ) : (
        <DataTable
          headers={[
            t('mySchedule.headers.shift'),
            t('mySchedule.headers.date'),
            t('mySchedule.headers.time'),
            t('mySchedule.headers.status'),
          ]}
        >
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <td>{assignment.shift?.name || t('mySchedule.shiftLabel', { id: assignment.shift_id })}</td>
              <td>{assignment.date}</td>
              <td>
                {formatTime(assignment.start_at)} - {formatTime(assignment.end_at)}
              </td>
              <td>
                <Badge variant={assignment.status === 'ACTIVE' ? 'success' : 'default'}>
                  {assignment.status === 'ACTIVE' ? t('mySchedule.statusActive') : t('mySchedule.statusCancelled')}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </AdminLayout>
  );
}

export default MySchedule;
