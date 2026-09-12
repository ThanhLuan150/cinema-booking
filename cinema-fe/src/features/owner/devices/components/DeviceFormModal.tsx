import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Device, DeviceStatus, Entrance } from '@/types/entities';
import { DEVICE_STATUSES, emptyDeviceForm } from '../constants';
import { useCreateDevice, useUpdateDevice } from '../hooks/useDeviceMutations';
import type { DeviceForm } from '../types/devices.types';

interface DeviceFormModalProps {
  mode: 'create' | 'edit';
  device?: Device;
  branchId: number | undefined;
  entrances: Entrance[];
  onClose: () => void;
  onCreated: (result: { device_id: string; api_key: string }) => void;
}

export function DeviceFormModal({ mode, device, branchId, entrances, onClose, onCreated }: DeviceFormModalProps) {
  const { t } = useTranslation('owner');
  const [form, setForm] = useState<DeviceForm>(
    mode === 'edit' && device
      ? {
          device_id: device.device_id,
          name: device.name,
          entrance_id: device.entrance_id ? String(device.entrance_id) : '',
          status: device.status,
        }
      : emptyDeviceForm,
  );

  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();

  const submit = async () => {
    try {
      if (mode === 'create') {
        if (!branchId) return;
        const created = await createDevice.mutateAsync({
          branch_id: branchId,
          device_id: form.device_id.trim(),
          name: form.name.trim(),
          entrance_id: form.entrance_id ? Number(form.entrance_id) : null,
          status: form.status,
        });
        onCreated({ device_id: created.device_id, api_key: created.api_key });
        toast.success(t('devices.createSuccess'));
      } else if (device) {
        await updateDevice.mutateAsync({
          id: device.id,
          name: form.name.trim(),
          entrance_id: form.entrance_id ? Number(form.entrance_id) : null,
          status: form.status,
        });
        toast.success(t('devices.updateSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const entranceOptions = [
    { label: t('devices.noEntrance'), value: '' },
    ...entrances.map((e) => ({ label: e.name, value: String(e.id) })),
  ];

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('devices.addTitle') : t('devices.editTitle')}>
      <div className="space-y-3">
        <Input
          id="device-form-device-id"
          label={t('devices.deviceIdLabel')}
          value={form.device_id}
          disabled={mode === 'edit'}
          onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
        />
        <Input
          id="device-form-name"
          label={t('devices.nameLabel')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Select
          label={t('devices.entranceLabel')}
          value={form.entrance_id}
          options={entranceOptions}
          onChange={(e) => setForm((f) => ({ ...f, entrance_id: e.target.value }))}
        />
        <Select
          label={t('devices.statusLabel')}
          value={form.status}
          options={DEVICE_STATUSES.map((s) => ({ label: t(`devices.status.${s}`), value: s }))}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DeviceStatus }))}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createDevice.isPending || updateDevice.isPending}
            disabled={!form.device_id.trim() || !form.name.trim()}
            onClick={submit}
          >
            {t('devices.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
