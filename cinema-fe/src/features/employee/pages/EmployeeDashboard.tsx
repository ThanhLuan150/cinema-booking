import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useRoomsList } from '@/features/booking/hooks/useRoomsList';
import { OperationalSummary } from '@/features/reporting/components/OperationalSummary';
import { usePermissions } from '@/hooks/usePermissions';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { ROUTES } from '@/constants/routes';
import { useMySchedules } from '../hooks/useMySchedules';
import { EmployeeDashboardScheduleTable } from '../components/EmployeeDashboardScheduleTable';

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
  const canViewOperational = hasPermission('report.viewOperational');

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
      {canViewOperational && <OperationalSummary />}

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

      <EmployeeDashboardScheduleTable
        schedules={todaySchedules}
        movieNameById={movieNameById}
        roomNameById={roomNameById}
        canSellTickets={canSellTickets}
        onSellTickets={(scheduleId) => navigate(`${ROUTES.employeeCounterSale}?scheduleId=${scheduleId}`)}
      />
    </AdminLayout>
  );
}

export default EmployeeDashboard;
