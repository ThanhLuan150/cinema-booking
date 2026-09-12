import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Schedule } from '../types/adminSchedule.types';

export interface ListItemProps {
  schedule: Schedule;
  cinemaName: string | undefined;
  roomName: string | number | undefined;
  movieName: string | number | undefined;
  canManageShowtimes: boolean;
  onReschedule: (schedule: Schedule) => void;
  onCancel: (id: number) => void;
}

export const ListItem = ({
  schedule,
  cinemaName,
  roomName,
  movieName,
  canManageShowtimes,
  onReschedule,
  onCancel,
}: ListItemProps) => {
  const { t } = useTranslation('admin');
  const isCancelled = schedule.status === 'CANCELLED';

  return (
    <tr>
      <td>{schedule.id}</td>
      <td>{movieName ?? schedule.movie_id}</td>
      <td>{cinemaName ?? '-'}</td>
      <td>{roomName ?? schedule.room_id}</td>
      <td>{schedule.time_begin}</td>
      <td>{schedule.time_end}</td>
      <td>{schedule.movie_date}</td>
      <td>{schedule.price}</td>
      <td>
        <Badge variant={isCancelled ? 'default' : 'success'}>
          {isCancelled ? t('schedules.list.statusCancelled') : t('schedules.list.statusActive')}
        </Badge>
      </td>
      <td>
        {canManageShowtimes && !isCancelled && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onReschedule(schedule)}>
              {t('schedules.list.rescheduleButton')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => onCancel(schedule.id)}
            >
              {t('schedules.list.cancelButton')}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
};
