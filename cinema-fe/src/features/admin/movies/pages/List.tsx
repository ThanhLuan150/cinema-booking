import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyMovies } from '../hooks/useMyMovies';
import AddSchedule from '../../schedules/components/Add';
import Add from '../components/Add';
import Edit from '../components/Edit';
import ListItem from '../components/ListItem';
import { closeScheduleModal, openAddModal } from '../store/adminMoviesSlice';

const List = () => {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyMovies(page, DEFAULT_PAGE_SIZE);
  const movies = data?.data ?? [];
  const { showAddModal, showEditModal, showScheduleModal, activeMovieId } = useAppSelector((state) => state.adminMovies);

  return (
    <AdminLayout breadcrumb={t('movies.list.breadcrumb')} loading={isLoading}>
      {/* Movie Catalog CRUD is Super Admin only — a branch admin only ever views it. */}
      {isAdmin && (
        <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
          {t('movies.list.addButton')}
        </Button>
      )}

      {isAdmin && showAddModal && <Add />}
      {isAdmin && showEditModal && <Edit />}
      {showScheduleModal && (
        <AddSchedule id={activeMovieId} handleCloseAddSchedule={() => dispatch(closeScheduleModal())} />
      )}

      <div className="mt-6">
        <DataTable headers={t('movies.list.headers', { returnObjects: true }) as unknown as string[]}>
          {movies.map((movie) => (
            <ListItem key={movie.id} movie={movie} />
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
};

export default List;
