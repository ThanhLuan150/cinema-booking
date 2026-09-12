import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useDirectors } from '../hooks/useDirectors';
import { openAddModal } from '../store/adminDirectorsSlice';
import Add from '../components/Add';
import ListItem from '../components/ListItem';

function DirectorList() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDirectors(page, DEFAULT_PAGE_SIZE);
  const directors = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.adminDirectors);

  return (
    <AdminLayout breadcrumb={t('directors.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('directors.addButton')}
      </Button>

      {showAddModal && <Add />}

      <div className="mt-6">
        <DataTable
          headers={[
            t('directors.headers.id'),
            t('directors.headers.fullName'),
            t('directors.headers.nationality'),
            t('directors.headers.actions'),
          ]}
        >
          {directors.map((director) => (
            <ListItem key={director.id} director={director} />
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default DirectorList;
