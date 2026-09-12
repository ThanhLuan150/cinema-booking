import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { useAppSelector } from '@/hooks/redux';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { adminCinemasQueryKey, useAdminCinemas } from '../hooks/useAdminCinemas';
import { useActivateCinema, useDisableCinema, useSetCinemaMaintenance, useDeleteCinema } from '../hooks/useCinemaModeration';
import { AddBranchAdminModal } from '../components/AddBranchAdminModal';
import { ListItem } from '../components/ListItem';

function AdminCinemas() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const { data, isLoading } = useAdminCinemas(page, DEFAULT_PAGE_SIZE);
  const cinemas = data?.data ?? [];
  const activateMutation = useActivateCinema();
  const disableMutation = useDisableCinema();
  const maintenanceMutation = useSetCinemaMaintenance();
  const deleteMutation = useDeleteCinema();

  const statusVersion = useAppSelector((state) => state.realtime.cinemaStatusVersion);
  useEffect(() => {
    if (statusVersion > 0) queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey });
  }, [statusVersion, queryClient]);

  const handleActivate = useCallback(
    async (id: number) => {
      try {
        await activateMutation.mutateAsync(id);
        toast.success(t('cinemas.activateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [activateMutation, t],
  );

  const handleDisable = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.disableConfirm')))) return;
      try {
        await disableMutation.mutateAsync(id);
        toast.success(t('cinemas.disableSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [disableMutation, t],
  );

  const handleMaintenance = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.maintenanceConfirm')))) return;
      try {
        await maintenanceMutation.mutateAsync(id);
        toast.success(t('cinemas.maintenanceSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [maintenanceMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('cinemas.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => setShowAddModal(true)}>
        {t('cinemas.addBranchAdmin.addButton')}
      </Button>

      {showAddModal && <AddBranchAdminModal onClose={() => setShowAddModal(false)} />}

      <div className="mt-6">
      <DataTable headers={t('cinemas.headers', { returnObjects: true }) as unknown as string[]}>
        {cinemas.map((cinema) => (
          <ListItem
            key={cinema.id}
            cinema={cinema}
            onActivate={handleActivate}
            onDisable={handleDisable}
            onMaintenance={handleMaintenance}
            onDelete={handleDelete}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default AdminCinemas;
