import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Device, Entrance } from '@/types/entities';
import { DEVICE_STATUS_VARIANT } from '../constants';
import { useDeleteDevice, useRotateDeviceKey } from '../hooks/useDeviceMutations';
import { DeviceFormModal } from './DeviceFormModal';
import { DeviceKeyModal } from './DeviceKeyModal';
import { DeviceLogsModal } from './DeviceLogsModal';

const formatLastSeen = (value: string | null, t: (key: string) => string) => (value ? new Date(value).toLocaleString() : t('devices.never'));

interface DevicesTableProps {
  devices: Device[];
  entrances: Entrance[];
  entranceNameById: Map<number, string>;
  branchNameById: Map<number, string>;
  isAllBranches: boolean;
  canManage: boolean;
  concreteBranchId: number | undefined;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  deviceModal: { mode: 'create' | 'edit'; device?: Device } | null;
  onOpenEditDevice: (device: Device) => void;
  onCloseDeviceModal: () => void;
}

export function DevicesTable({
  devices,
  entrances,
  entranceNameById,
  branchNameById,
  isAllBranches,
  canManage,
  concreteBranchId,
  page,
  totalPages,
  onPageChange,
  deviceModal,
  onOpenEditDevice,
  onCloseDeviceModal,
}: DevicesTableProps) {
  const { t } = useTranslation('owner');
  const rotateKey = useRotateDeviceKey();
  const deleteDevice = useDeleteDevice();

  const [revealedKey, setRevealedKey] = useState<{ device_id: string; api_key: string } | null>(null);
  const [logsDevice, setLogsDevice] = useState<Device | null>(null);

  const handleRotateKey = useCallback(
    async (device: Device) => {
      if (!(await confirmDialog(t('devices.rotateConfirm')))) return;
      try {
        const { api_key } = await rotateKey.mutateAsync(device.id);
        setRevealedKey({ device_id: device.device_id, api_key });
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [rotateKey, t],
  );

  const handleDeleteDevice = useCallback(
    async (device: Device) => {
      if (!(await confirmDialog(t('devices.deleteConfirm')))) return;
      try {
        await deleteDevice.mutateAsync(device.id);
        toast.success(t('devices.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteDevice, t],
  );

  return (
    <>
      <DataTable
        headers={[
          t('devices.headers.deviceId'),
          ...(isAllBranches ? [t('devices.headers.branch')] : []),
          t('devices.headers.name'),
          t('devices.headers.entrance'),
          t('devices.headers.status'),
          t('devices.headers.lastSeen'),
          t('devices.headers.actions'),
        ]}
      >
        {devices.map((d) => (
          <tr key={d.id}>
            <td className="font-mono text-xs">{d.device_id}</td>
            {isAllBranches && <td>{branchNameById.get(d.branch_id) || d.branch_id}</td>}
            <td>{d.name}</td>
            <td>{d.entrance_id ? entranceNameById.get(d.entrance_id) || `#${d.entrance_id}` : t('devices.noEntrance')}</td>
            <td>
              <Badge variant={DEVICE_STATUS_VARIANT[d.status]}>{t(`devices.status.${d.status}`)}</Badge>
            </td>
            <td className="text-sm text-txt/70">{formatLastSeen(d.last_seen_at, t)}</td>
            <td className="flex flex-wrap gap-3">
              <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => setLogsDevice(d)}>
                {t('devices.viewLogs')}
              </button>
              {canManage && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => onOpenEditDevice(d)}>
                    {t('devices.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handleRotateKey(d)}>
                    {t('devices.rotateKey')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteDevice(d)}>
                    {t('devices.delete')}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />

      {deviceModal && (
        <DeviceFormModal
          mode={deviceModal.mode}
          device={deviceModal.device}
          branchId={concreteBranchId}
          entrances={entrances}
          onClose={onCloseDeviceModal}
          onCreated={(result) => setRevealedKey(result)}
        />
      )}

      {revealedKey && (
        <DeviceKeyModal deviceId={revealedKey.device_id} apiKey={revealedKey.api_key} onClose={() => setRevealedKey(null)} />
      )}

      {logsDevice && <DeviceLogsModal device={logsDevice} onClose={() => setLogsDevice(null)} />}
    </>
  );
}
