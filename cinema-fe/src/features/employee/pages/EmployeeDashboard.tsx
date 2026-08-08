import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useRoomsList } from '@/features/booking/hooks/useRoomsList';
import { usePermissions } from '@/hooks/usePermissions';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { ROUTES } from '@/constants/routes';
import { useMySchedules } from '../hooks/useMySchedules';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function EmployeeDashboard() {
  const { t } = useTranslation('employee');
  const navigate = useNavigate();
  const { data: schedulesPage } = useMySchedules();
  const { data: moviesPage } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const { data: rooms } = useRoomsList();
  const { hasPermission } = usePermissions();
  const canSellTickets = hasPermission('booking.create');
  const canCheckIn = hasPermission('ticket.checkin');

  const movieNameById = useMemo(
    () => new Map((moviesPage?.data ?? []).map((movie) => [movie.id, movie.name])),
    [moviesPage],
  );
  const roomNameById = useMemo(() => new Map((rooms ?? []).map((room) => [room.id, room.name])), [rooms]);

  const todaySchedules = useMemo(() => {
    const today = todayIso();
    return (schedulesPage?.data ?? [])
      .filter((schedule) => schedule.movie_date === today)
      .sort((a, b) => a.time_begin.localeCompare(b.time_begin));
  }, [schedulesPage]);

  return (
    <AdminLayout breadcrumb={t('dashboard.breadcrumb')}>
      <div className="mb-4 flex flex-wrap gap-3">
        {canSellTickets && (
          <Button type="button" variant="danger" onClick={() => navigate(ROUTES.employeeCounterSale)}>
            {t('dashboard.sellTickets')}
          </Button>
        )}
        {canCheckIn && (
          <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.employeeCheckIn)}>
            {t('dashboard.checkIn')}
          </Button>
        )}
      </div>

      {todaySchedules.length === 0 ? (
        <EmptyState title={t('dashboard.noShowtimesToday')} />
      ) : (
        <DataTable
          headers={[
            t('dashboard.headers.movie'),
            t('dashboard.headers.room'),
            t('dashboard.headers.time'),
            t('dashboard.headers.price'),
            t('dashboard.headers.actions'),
          ]}
        >
          {todaySchedules.map((schedule) => (
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
                    onClick={() => navigate(`${ROUTES.employeeCounterSale}?scheduleId=${schedule.id}`)}
                  >
                    {t('dashboard.sellTickets')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </AdminLayout>
  );
}

export default EmployeeDashboard;
