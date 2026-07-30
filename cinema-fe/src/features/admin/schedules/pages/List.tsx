import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useAllRooms } from '@/features/owner/hooks/useAllRooms';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '../../movies/hooks/useMyMovies';
import { useSchedules } from '../hooks/useSchedules';

const List = () => {
  const { t } = useTranslation('admin');
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = cinemasPage?.data;
  const { data: roomsPage } = useAllRooms();
  const rooms = roomsPage?.data;
  const { data: moviesPage } = useMyMovies(1, FULL_LIST_FETCH_LIMIT);
  const movies = moviesPage?.data;

  const [cinemaFilter, setCinemaFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data } = useSchedules({ cinemaId: cinemaFilter || undefined, roomId: roomFilter || undefined }, page, DEFAULT_PAGE_SIZE);
  const schedules = data?.data ?? [];

  const roomById = useMemo(() => new Map((rooms ?? []).map((room) => [String(room.id), room])), [rooms]);
  const cinemaNameById = useMemo(
    () => new Map((cinemas ?? []).map((cinema) => [String(cinema.id), cinema.name])),
    [cinemas],
  );
  const movieNameById = useMemo(
    () => new Map((movies ?? []).map((movie) => [String(movie.id), movie.name])),
    [movies],
  );

  const roomOptions = (rooms ?? [])
    .filter((room) => !cinemaFilter || String(room.cinema_id) === cinemaFilter)
    .map((room) => ({ label: room.name, value: room.id }));

  const handleCinemaFilterChange = (e: { target: { value: string } }) => {
    setCinemaFilter(e.target.value);
    setRoomFilter('');
    setPage(1);
  };

  const handleRoomFilterChange = (e: { target: { value: string } }) => {
    setRoomFilter(e.target.value);
    setPage(1);
  };

  return (
    <AdminLayout breadcrumb={t('schedules.list.breadcrumb')}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={cinemaFilter}
          onChange={handleCinemaFilterChange}
          placeholder={t('schedules.list.filterCinemaPlaceholder')}
          options={(cinemas ?? []).map((cinema) => ({ label: cinema.name, value: cinema.id }))}
          className="w-56 bg-white"
        />
        <Select
          value={roomFilter}
          onChange={handleRoomFilterChange}
          placeholder={t('schedules.list.filterRoomPlaceholder')}
          options={roomOptions}
          className="w-56 bg-white"
        />
      </div>

      <DataTable headers={t('schedules.list.headers', { returnObjects: true }) as unknown as string[]}>
        {schedules.map((schedule) => {
          const room = roomById.get(String(schedule.room_id));
          const cinemaName = room ? cinemaNameById.get(String(room.cinema_id)) : undefined;
          return (
            <tr key={schedule.id}>
              <td>{schedule.id}</td>
              <td>{movieNameById.get(String(schedule.movie_id)) ?? schedule.movie_id}</td>
              <td>{cinemaName ?? '-'}</td>
              <td>{room?.name ?? schedule.room_id}</td>
              <td>{schedule.time_begin}</td>
              <td>{schedule.time_end}</td>
              <td>{schedule.movie_date}</td>
              <td>{schedule.price}</td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
};
export default List;
