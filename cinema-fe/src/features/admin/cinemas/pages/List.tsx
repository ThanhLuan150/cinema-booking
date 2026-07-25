import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { useAppSelector } from '@/hooks/redux';
import { getApiErrorMessage } from '@/lib/apiError';
import { adminCinemasQueryKey, useAdminCinemas } from '../hooks/useAdminCinemas';
import { useApproveCinema, useBlockCinema, useDeleteCinema } from '../hooks/useCinemaModeration';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';

function AdminCinemas() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const { data: cinemas = [] } = useAdminCinemas();
  const approveMutation = useApproveCinema();
  const blockMutation = useBlockCinema();
  const deleteMutation = useDeleteCinema();

  const pendingVersion = useAppSelector((state) => state.realtime.cinemaPendingVersion);
  useEffect(() => {
    if (pendingVersion > 0) queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey });
  }, [pendingVersion, queryClient]);

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success(t('cinemas.approveSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleBlock = async (id: number) => {
    if (!(await confirmDialog(t('cinemas.blockConfirm')))) return;
    try {
      await blockMutation.mutateAsync(id);
      toast.success(t('cinemas.blockSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog(t('cinemas.deleteConfirm')))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('cinemas.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')}>
      <DataTable headers={t('cinemas.headers', { returnObjects: true }) as unknown as string[]}>
        {cinemas.map((cinema) => {
          const status = CINEMA_STATUS_META[cinema.status] || CINEMA_STATUS_META[CINEMA_STATUS.pending];
          return (
            <tr key={cinema.id}>
              <td>{cinema.id}</td>
              <td>{cinema.name}</td>
              <td>{cinema.owner_id}</td>
              <td>
                {cinema.address} {cinema.city}
              </td>
              <td>
                <span className={`rounded px-2 py-0.5 text-xs ${status.className}`}>{t(`cinemas.status.${status.key}`)}</span>
              </td>
              <td className="flex gap-3">
                {cinema.status !== CINEMA_STATUS.approved && (
                  <button type="button" className="text-accent" onClick={() => handleApprove(cinema.id)}>
                    {t('cinemas.approveButton')}
                  </button>
                )}
                {cinema.status !== CINEMA_STATUS.blocked && (
                  <button type="button" className="text-amber-400" onClick={() => handleBlock(cinema.id)}>
                    {t('cinemas.blockButton')}
                  </button>
                )}
                <button type="button" className="text-red-500" onClick={() => handleDelete(cinema.id)}>
                  {t('cinemas.deleteButton')}
                </button>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </AdminLayout>
  );
}

export default AdminCinemas;
