import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ParkingArea } from '@/types/entities';
import { AREA_STATUS_VARIANT } from '../constants';
import { useDeleteParkingArea } from '../hooks/useParkingMutations';
import { AreaFormModal } from './AreaFormModal';
import { SlotsModal } from './SlotsModal';

interface AreasPanelProps {
  areas: ParkingArea[];
  canManage: boolean;
  concreteBranchId: number | undefined;
}

export function AreasPanel({ areas, canManage, concreteBranchId }: AreasPanelProps) {
  const { t } = useTranslation('owner');
  const deleteArea = useDeleteParkingArea();

  const [areaModal, setAreaModal] = useState<{ mode: 'create' | 'edit'; area?: ParkingArea } | null>(null);
  const [slotsArea, setSlotsArea] = useState<ParkingArea | null>(null);

  const openCreateArea = useCallback(() => setAreaModal({ mode: 'create' }), []);
  const openEditArea = useCallback((area: ParkingArea) => setAreaModal({ mode: 'edit', area }), []);

  const handleDeleteArea = useCallback(
    async (area: ParkingArea) => {
      if (!(await confirmDialog(t('parking.areaDeleteConfirm')))) return;
      try {
        await deleteArea.mutateAsync(area.id);
        toast.success(t('parking.areaDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteArea, t],
  );

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('parking.areasTitle')}</h3>
        {canManage && concreteBranchId && (
          <Button type="button" size="sm" variant="secondary" onClick={openCreateArea}>
            {t('parking.addAreaButton')}
          </Button>
        )}
      </div>
      {areas.length === 0 ? (
        <p className="text-sm text-txt/60">{t('parking.noAreas')}</p>
      ) : (
        <DataTable
          headers={[
            t('parking.areaHeaders.name'),
            t('parking.areaHeaders.capacity'),
            t('parking.areaHeaders.status'),
            t('parking.areaHeaders.actions'),
          ]}
        >
          {areas.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.capacity}</td>
              <td>
                <Badge variant={AREA_STATUS_VARIANT[a.status]}>{t(`parking.areaStatus.${a.status}`)}</Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => setSlotsArea(a)}>
                  {t('parking.slots')}
                </button>
                {canManage && (
                  <>
                    <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEditArea(a)}>
                      {t('parking.edit')}
                    </button>
                    <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteArea(a)}>
                      {t('parking.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {areaModal && (
        <AreaFormModal mode={areaModal.mode} area={areaModal.area} branchId={concreteBranchId} onClose={() => setAreaModal(null)} />
      )}
      {slotsArea && <SlotsModal area={slotsArea} canManage={canManage} onClose={() => setSlotsArea(null)} />}
    </div>
  );
}
