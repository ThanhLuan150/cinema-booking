import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useAllRooms } from '@/features/owner/hooks/useAllRooms';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/constants/roles';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '../../movies/hooks/useMyMovies';
import { useSchedules } from '../hooks/useSchedules';
import { useCancelSchedule } from '../hooks/useCancelSchedule';
import Add from '../components/Add';
import Reschedule from '../components/Reschedule';
import { FilterBar } from '../components/FilterBar';
import { ListItem } from '../components/ListItem';
import type { Schedule } from '../types/adminSchedule.types';

const List = () => {
  const { t } = useTranslation('admin');
  const role = useAuthRole();
  // Both Super Admin (ALL scope) and Branch Admin (BRANCH scope) can create/cancel showtimes.
  const canManageShowtimes = role === ROLES.admin || role === ROLES.owner;
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = cinemasPage?.data;
  const { data: roomsPage } = useAllRooms();
  const rooms = roomsPage?.data;
  const { data: moviesPage } = useMyMovies(1, FULL_LIST_FETCH_LIMIT);
  const movies = moviesPage?.data;

  const [cinemaFilter, setCinemaFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Schedule | null>(null);

  const { data, isLoading } = useSchedules({ branchId: cinemaFilter || undefined, roomId: roomFilter || undefined }, page, DEFAULT_PAGE_SIZE);
  const schedules = data?.data ?? [];
  const cancelScheduleMutation = useCancelSchedule();

  const roomById = useMemo(() => new Map((rooms ?? []).map((room) => [String(room.id), room])), [rooms]);
  const cinemaNameById = useMemo(
    () => new Map((cinemas ?? []).map((cinema) => [String(cinema.id), cinema.name])),
    [cinemas],
  );
  const movieNameById = useMemo(
    () => new Map((movies ?? []).map((movie) => [String(movie.id), movie.name])),
    [movies],
  );

  const roomOptions = useMemo(
    () =>
      (rooms ?? [])
        .filter((room) => !cinemaFilter || String(room.cinema_id) === cinemaFilter)
        .map((room) => ({ label: room.name, value: room.id })),
    [rooms, cinemaFilter],
  );

  const handleCinemaFilterChange = useCallback((e: { target: { value: string } }) => {
    setCinemaFilter(e.target.value);
    setRoomFilter('');
    setPage(1);
  }, []);

  const handleRoomFilterChange = useCallback((e: { target: { value: string } }) => {
    setRoomFilter(e.target.value);
    setPage(1);
  }, []);

  const handleCancel = async (id: number) => {
    if (!(await confirmDialog(t('schedules.list.cancelConfirm')))) return;
    try {
      await cancelScheduleMutation.mutateAsync(id);
      toast.success(t('schedules.list.cancelToastSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('schedules.list.cancelToastError'));
    }
  };

  return (
    <AdminLayout breadcrumb={t('schedules.list.breadcrumb')} loading={isLoading}>
      <FilterBar
        cinemas={cinemas ?? []}
        roomOptions={roomOptions}
        cinemaFilter={cinemaFilter}
        roomFilter={roomFilter}
        onCinemaFilterChange={handleCinemaFilterChange}
        onRoomFilterChange={handleRoomFilterChange}
        canManageShowtimes={canManageShowtimes}
        onAddClick={() => setShowAddModal(true)}
      />

      {showAddModal && <Add id={null} handleCloseAddSchedule={() => setShowAddModal(false)} />}
      {rescheduleTarget && <Reschedule schedule={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}

      <DataTable headers={t('schedules.list.headers', { returnObjects: true }) as unknown as string[]}>
        {schedules.map((schedule) => {
          const room = roomById.get(String(schedule.room_id));
          const cinemaName = room ? cinemaNameById.get(String(room.cinema_id)) : undefined;
          return (
            <ListItem
              key={schedule.id}
              schedule={schedule}
              cinemaName={cinemaName}
              roomName={room?.name ?? schedule.room_id}
              movieName={movieNameById.get(String(schedule.movie_id)) ?? schedule.movie_id}
              canManageShowtimes={canManageShowtimes}
              onReschedule={setRescheduleTarget}
              onCancel={handleCancel}
            />
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
};
export default List;
