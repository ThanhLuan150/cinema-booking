import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { Schedule } from '@/types/entities';

export function EmployeeDashboardScheduleTable({
  schedules,
  movieNameById,
  roomNameById,
  canSellTickets,
  onSellTickets,
}: {
  schedules: Schedule[];
  movieNameById: Map<number, string>;
  roomNameById: Map<number, string>;
  canSellTickets: boolean;
  onSellTickets: (scheduleId: number) => void;
}) {
  const { t } = useTranslation('employee');

  if (schedules.length === 0) {
    return <EmptyState title={t('dashboard.noShowtimesToday')} />;
  }

  return (
    <DataTable
      headers={[
        t('dashboard.headers.movie'),
        t('dashboard.headers.room'),
        t('dashboard.headers.time'),
        t('dashboard.headers.price'),
        t('dashboard.headers.actions'),
      ]}
    >
      {schedules.map((schedule) => (
        <tr key={schedule.id}>
          <td>{movieNameById.get(schedule.movie_id) ?? schedule.movie_id}</td>
          <td>{roomNameById.get(schedule.room_id) ?? schedule.room_id}</td>
          <td>
            {schedule.time_begin} - {schedule.time_end}
          </td>
          <td>{schedule.price.toLocaleString()}đ</td>
          <td>
            {canSellTickets && (
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onSellTickets(schedule.id)}
              >
                {t('dashboard.sellTickets')}
              </button>
            )}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
