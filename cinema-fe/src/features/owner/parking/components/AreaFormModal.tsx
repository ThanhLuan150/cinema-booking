import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ParkingArea, ParkingAreaStatus } from '@/types/entities';
import { AREA_STATUSES, emptyAreaForm } from '../constants';
import { useCreateParkingArea, useUpdateParkingArea } from '../hooks/useParkingMutations';
import type { AreaForm } from '../types/parking.types';

interface AreaFormModalProps {
  mode: 'create' | 'edit';
  area?: ParkingArea;
  branchId: number | undefined;
  onClose: () => void;
}

export function AreaFormModal({ mode, area, branchId, onClose }: AreaFormModalProps) {
  const { t } = useTranslation('owner');
  const [form, setForm] = useState<AreaForm>(
    mode === 'edit' && area ? { name: area.name, capacity: String(area.capacity), status: area.status } : emptyAreaForm,
  );

  const createArea = useCreateParkingArea();
  const updateArea = useUpdateParkingArea();

  const submit = async () => {
    try {
      const capacity = Number(form.capacity) || 0;
      if (mode === 'create') {
        if (!branchId) return;
        await createArea.mutateAsync({ branch_id: branchId, name: form.name.trim(), capacity, status: form.status });
        toast.success(t('parking.areaCreateSuccess'));
      } else if (area) {
        await updateArea.mutateAsync({ id: area.id, name: form.name.trim(), capacity, status: form.status });
        toast.success(t('parking.areaUpdateSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('parking.addAreaTitle') : t('parking.editAreaTitle')}>
      <div className="space-y-3">
        <Input
          id="parking-area-name"
          label={t('parking.nameLabel')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="parking-area-capacity"
          type="number"
          label={t('parking.capacityLabel')}
          value={form.capacity}
          onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
        />
        <Select
          label={t('parking.statusLabel')}
          value={form.status}
          options={AREA_STATUSES.map((s) => ({ label: t(`parking.areaStatus.${s}`), value: s }))}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ParkingAreaStatus }))}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createArea.isPending || updateArea.isPending}
            disabled={!form.name.trim()}
            onClick={submit}
          >
            {t('parking.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
