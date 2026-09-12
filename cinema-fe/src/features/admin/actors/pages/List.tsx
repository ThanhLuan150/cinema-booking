import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useActors } from '../hooks/useActors';
import { openAddModal } from '../store/adminActorsSlice';
import Add from '../components/Add';
import ListItem from '../components/ListItem';

function ActorList() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useActors(page, DEFAULT_PAGE_SIZE);
  const actors = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.adminActors);

  return (
    <AdminLayout breadcrumb={t('actors.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('actors.addButton')}
      </Button>

      {showAddModal && <Add />}

      <div className="mt-6">
        <DataTable
          headers={[
            t('actors.headers.id'),
            t('actors.headers.fullName'),
            t('actors.headers.nationality'),
            t('actors.headers.actions'),
          ]}
        >
          {actors.map((actor) => (
            <ListItem key={actor.id} actor={actor} />
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default ActorList;
