import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMyMovies } from '../hooks/useMyMovies';
import AddSchedule from '../../schedules/components/Add';
import Add from '../components/Add';
import Edit from '../components/Edit';
import ListItem from '../components/ListItem';
import { closeScheduleModal, openAddModal } from '../store/adminMoviesSlice';

const List = () => {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const { data: movies = [] } = useMyMovies();
  const { showAddModal, showEditModal, showScheduleModal, activeMovieId } = useAppSelector((state) => state.adminMovies);

  return (
    <AdminLayout breadcrumb={t('movies.list.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('movies.list.addButton')}
      </Button>

      {showAddModal && <Add />}
      {showEditModal && <Edit />}
      {showScheduleModal && (
        <AddSchedule id={activeMovieId} handleCloseAddSchedule={() => dispatch(closeScheduleModal())} />
      )}

      <div className="mt-6">
        <DataTable headers={t('movies.list.headers', { returnObjects: true }) as unknown as string[]}>
          {movies.map((movie) => (
            <ListItem key={movie.id} movie={movie} />
          ))}
        </DataTable>
      </div>
    </AdminLayout>
  );
};

export default List;
