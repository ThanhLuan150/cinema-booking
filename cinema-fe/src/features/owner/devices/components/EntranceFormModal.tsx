import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Entrance, EntranceStatus } from '@/types/entities';
import { ENTRANCE_STATUSES, emptyEntranceForm } from '../constants';
import { useCreateEntrance, useUpdateEntrance } from '../hooks/useDeviceMutations';
import type { EntranceForm } from '../types/devices.types';

interface EntranceFormModalProps {
  mode: 'create' | 'edit';
  entrance?: Entrance;
  branchId: number | undefined;
  onClose: () => void;
}

export function EntranceFormModal({ mode, entrance, branchId, onClose }: EntranceFormModalProps) {
  const { t } = useTranslation('owner');
  const [form, setForm] = useState<EntranceForm>(
    mode === 'edit' && entrance ? { name: entrance.name, code: entrance.code, status: entrance.status } : emptyEntranceForm,
  );

  const createEntrance = useCreateEntrance();
  const updateEntrance = useUpdateEntrance();

  const submit = async () => {
    try {
      if (mode === 'create') {
        if (!branchId) return;
        await createEntrance.mutateAsync({
          branch_id: branchId,
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          status: form.status,
        });
        toast.success(t('devices.entranceCreateSuccess'));
      } else if (entrance) {
        await updateEntrance.mutateAsync({
          id: entrance.id,
          name: form.name.trim(),
          code: form.code.trim(),
          status: form.status,
        });
        toast.success(t('devices.entranceUpdateSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('devices.addEntranceTitle') : t('devices.editEntranceTitle')}>
      <div className="space-y-3">
        <Input
          id="entrance-form-name"
          label={t('devices.entranceNameLabel')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="entrance-form-code"
          label={t('devices.entranceCodeLabel')}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <Select
          label={t('devices.statusLabel')}
          value={form.status}
          options={ENTRANCE_STATUSES.map((s) => ({ label: t(`devices.entranceStatus.${s}`), value: s }))}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EntranceStatus }))}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createEntrance.isPending || updateEntrance.isPending}
            disabled={!form.name.trim()}
            onClick={submit}
          >
            {t('devices.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
