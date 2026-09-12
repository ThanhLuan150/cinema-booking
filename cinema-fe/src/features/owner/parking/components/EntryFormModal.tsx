import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ParkingSlot, ParkingVehicleType } from '@/types/entities';
import { VEHICLE_TYPES, emptyEntryForm } from '../constants';
import { useEnterVehicle } from '../hooks/useParkingMutations';
import type { EntryForm } from '../types/parking.types';

interface EntryFormModalProps {
  branchId: number | undefined;
  freeSlots: ParkingSlot[];
  areaNameById: Map<number, string>;
  onClose: () => void;
}

export function EntryFormModal({ branchId, freeSlots, areaNameById, onClose }: EntryFormModalProps) {
  const { t } = useTranslation('owner');
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);
  const enterVehicle = useEnterVehicle();

  const submitEntry = async () => {
    if (!branchId) return;
    try {
      await enterVehicle.mutateAsync({
        branch_id: branchId,
        vehicle_type: entryForm.vehicle_type,
        vehicle_plate: entryForm.vehicle_plate.trim(),
        slot_id: entryForm.slot_id ? Number(entryForm.slot_id) : null,
      });
      toast.success(t('parking.entrySuccess'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const slotOptions = [
    { label: t('parking.autoAssign'), value: '' },
    ...freeSlots
      .filter((s) => s.vehicle_type === entryForm.vehicle_type)
      .map((s) => ({ label: `${areaNameById.get(s.parking_area_id) ?? '?'} · ${s.slot_code}`, value: String(s.id) })),
  ];

  return (
    <Modal open onClose={onClose} title={t('parking.entryTitle')}>
      <div className="space-y-3">
        <Select
          label={t('parking.vehicleTypeLabel')}
          value={entryForm.vehicle_type}
          options={VEHICLE_TYPES.map((v) => ({ label: t(`parking.vehicleType.${v}`), value: v }))}
          onChange={(e) => setEntryForm((f) => ({ ...f, vehicle_type: e.target.value as ParkingVehicleType, slot_id: '' }))}
        />
        <Input
          id="parking-entry-plate"
          label={t('parking.plateLabel')}
          value={entryForm.vehicle_plate}
          onChange={(e) => setEntryForm((f) => ({ ...f, vehicle_plate: e.target.value }))}
        />
        <Select
          label={t('parking.slotLabel')}
          value={entryForm.slot_id}
          options={slotOptions}
          onChange={(e) => setEntryForm((f) => ({ ...f, slot_id: e.target.value }))}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={enterVehicle.isPending} disabled={!entryForm.vehicle_plate.trim()} onClick={submitEntry}>
            {t('parking.admit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
