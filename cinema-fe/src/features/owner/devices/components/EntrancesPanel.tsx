import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Entrance } from '@/types/entities';
import { useDeleteEntrance } from '../hooks/useDeviceMutations';
import { EntranceFormModal } from './EntranceFormModal';

interface EntrancesPanelProps {
  entrances: Entrance[];
  canManageEntrances: boolean;
  concreteBranchId: number | undefined;
}

export function EntrancesPanel({ entrances, canManageEntrances, concreteBranchId }: EntrancesPanelProps) {
  const { t } = useTranslation('owner');
  const deleteEntrance = useDeleteEntrance();

  const [entranceModal, setEntranceModal] = useState<{ mode: 'create' | 'edit'; entrance?: Entrance } | null>(null);

  const openCreateEntrance = useCallback(() => setEntranceModal({ mode: 'create' }), []);
  const openEditEntrance = useCallback((entrance: Entrance) => setEntranceModal({ mode: 'edit', entrance }), []);

  const handleDeleteEntrance = useCallback(
    async (entrance: Entrance) => {
      if (!(await confirmDialog(t('devices.entranceDeleteConfirm')))) return;
      try {
        await deleteEntrance.mutateAsync(entrance.id);
        toast.success(t('devices.entranceDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteEntrance, t],
  );

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('devices.entrancesTitle')}</h3>
        {canManageEntrances && concreteBranchId && (
          <Button type="button" size="sm" variant="secondary" onClick={openCreateEntrance}>
            {t('devices.addEntranceButton')}
          </Button>
        )}
      </div>
      {entrances.length === 0 ? (
        <p className="text-sm text-txt/60">{t('devices.noEntrances')}</p>
      ) : (
        <DataTable
          headers={[
            t('devices.entranceHeaders.name'),
            t('devices.entranceHeaders.code'),
            t('devices.entranceHeaders.status'),
            t('devices.entranceHeaders.actions'),
          ]}
        >
          {entrances.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.code || '—'}</td>
              <td>
                <Badge variant={e.status === 'ACTIVE' ? 'success' : 'default'}>{t(`devices.entranceStatus.${e.status}`)}</Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {canManageEntrances && (
                  <>
                    <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEditEntrance(e)}>
                      {t('devices.edit')}
                    </button>
                    <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteEntrance(e)}>
                      {t('devices.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {entranceModal && (
        <EntranceFormModal mode={entranceModal.mode} entrance={entranceModal.entrance} branchId={concreteBranchId} onClose={() => setEntranceModal(null)} />
      )}
    </div>
  );
}
