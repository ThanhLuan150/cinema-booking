import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useAllRooms } from '@/features/owner/hooks/useAllRooms';
import { useMyMovies } from '../../movies/hooks/useMyMovies';
import { useSchedules } from '../hooks/useSchedules';

const List = () => {
  const { t } = useTranslation('admin');
  const { data: schedules = [] } = useSchedules();
  const { data: cinemas = [] } = useMyCinemas();
  const { data: rooms = [] } = useAllRooms();
  const { data: movies = [] } = useMyMovies();

  const [cinemaFilter, setCinemaFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');

  const roomById = useMemo(() => new Map(rooms.map((room) => [String(room.id), room])), [rooms]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((cinema) => [String(cinema.id), cinema.name])), [cinemas]);
  const movieNameById = useMemo(() => new Map(movies.map((movie) => [String(movie.id), movie.name])), [movies]);

  const roomOptions = rooms
    .filter((room) => !cinemaFilter || String(room.cinema_id) === cinemaFilter)
    .map((room) => ({ label: room.name, value: room.id }));

  const handleCinemaFilterChange = (e: { target: { value: string } }) => {
    setCinemaFilter(e.target.value);
    setRoomFilter('');
  };

  const filteredSchedules = schedules.filter((schedule) => {
    const room = roomById.get(String(schedule.room_id));
    if (cinemaFilter && String(room?.cinema_id) !== cinemaFilter) return false;
    if (roomFilter && String(schedule.room_id) !== roomFilter) return false;
    return true;
  });

  return (
    <AdminLayout breadcrumb={t('schedules.list.breadcrumb')}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={cinemaFilter}
          onChange={handleCinemaFilterChange}
          placeholder={t('schedules.list.filterCinemaPlaceholder')}
          options={cinemas.map((cinema) => ({ label: cinema.name, value: cinema.id }))}
          className="w-56 bg-white"
        />
        <Select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          placeholder={t('schedules.list.filterRoomPlaceholder')}
          options={roomOptions}
          className="w-56 bg-white"
        />
      </div>

      <DataTable headers={t('schedules.list.headers', { returnObjects: true }) as unknown as string[]}>
        {filteredSchedules.map((schedule) => {
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
    </AdminLayout>
  );
};
export default List;
