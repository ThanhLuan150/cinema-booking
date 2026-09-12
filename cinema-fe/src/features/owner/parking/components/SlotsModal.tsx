import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { ParkingArea, ParkingSlot, ParkingSlotStatus, ParkingVehicleType } from '@/types/entities';
import { SLOT_STATUSES, SLOT_STATUS_VARIANT, VEHICLE_TYPES, emptySlotForm } from '../constants';
import { useParkingSlots } from '../hooks/useParkingSlots';
import { useCreateParkingSlot, useDeleteParkingSlot, useUpdateParkingSlot } from '../hooks/useParkingMutations';
import type { SlotForm } from '../types/parking.types';

interface SlotsModalProps {
  area: ParkingArea;
  canManage: boolean;
  onClose: () => void;
}

export function SlotsModal({ area, canManage, onClose }: SlotsModalProps) {
  const { t } = useTranslation('owner');
  const [page, setPage] = useState(1);
  const { data } = useParkingSlots(area.id, page, DEFAULT_PAGE_SIZE);
  const slots = data?.data ?? [];

  const createSlot = useCreateParkingSlot();
  const updateSlot = useUpdateParkingSlot();
  const deleteSlot = useDeleteParkingSlot();

  const [form, setForm] = useState<SlotForm>(emptySlotForm);
  const [editing, setEditing] = useState<ParkingSlot | null>(null);

  const submit = async () => {
    try {
      if (editing) {
        await updateSlot.mutateAsync({ id: editing.id, slot_code: form.slot_code.trim(), vehicle_type: form.vehicle_type, status: form.status });
        toast.success(t('parking.slotUpdateSuccess'));
      } else {
        await createSlot.mutateAsync({ parking_area_id: area.id, slot_code: form.slot_code.trim(), vehicle_type: form.vehicle_type, status: form.status });
        toast.success(t('parking.slotCreateSuccess'));
      }
      setForm(emptySlotForm);
      setEditing(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const remove = async (slot: ParkingSlot) => {
    if (!(await confirmDialog(t('parking.slotDeleteConfirm')))) return;
    try {
      await deleteSlot.mutateAsync(slot.id);
      toast.success(t('parking.slotDeleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('parking.slotsTitle', { name: area.name })} className="max-w-2xl">
      {slots.length === 0 ? (
        <p className="text-sm text-txt/60">{t('parking.noSlots')}</p>
      ) : (
        <DataTable
          headers={[
            t('parking.slotHeaders.code'),
            t('parking.slotHeaders.vehicleType'),
            t('parking.slotHeaders.status'),
            ...(canManage ? [t('parking.slotHeaders.actions')] : []),
          ]}
        >
          {slots.map((s) => (
            <tr key={s.id}>
              <td className="font-mono text-xs">{s.slot_code}</td>
              <td>{t(`parking.vehicleType.${s.vehicle_type}`)}</td>
              <td>
                <Badge variant={SLOT_STATUS_VARIANT[s.status]}>{t(`parking.slotStatus.${s.status}`)}</Badge>
              </td>
              {canManage && (
                <td className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => {
                      setEditing(s);
                      setForm({ slot_code: s.slot_code, vehicle_type: s.vehicle_type, status: s.status });
                    }}
                  >
                    {t('parking.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => remove(s)}>
                    {t('parking.delete')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {canManage && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold">{editing ? t('parking.editSlotTitle') : t('parking.addSlotTitle')}</h4>
          <Input id="parking-slot-code" label={t('parking.slotCodeLabel')} value={form.slot_code} onChange={(e) => setForm((f) => ({ ...f, slot_code: e.target.value }))} />
          <Select
            label={t('parking.vehicleTypeLabel')}
            value={form.vehicle_type}
            options={VEHICLE_TYPES.map((v) => ({ label: t(`parking.vehicleType.${v}`), value: v }))}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value as ParkingVehicleType }))}
          />
          <Select
            label={t('parking.statusLabel')}
            value={form.status}
            options={SLOT_STATUSES.filter((s) => s !== 'OCCUPIED').map((s) => ({ label: t(`parking.slotStatus.${s}`), value: s }))}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ParkingSlotStatus }))}
          />
          <div className="flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(emptySlotForm); }}>
                {t('parking.cancel')}
              </Button>
            )}
            <Button type="button" variant="danger" loading={createSlot.isPending || updateSlot.isPending} disabled={!form.slot_code.trim()} onClick={submit}>
              {t('parking.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
