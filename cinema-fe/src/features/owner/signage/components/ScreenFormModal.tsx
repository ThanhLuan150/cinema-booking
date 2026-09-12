import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { ScreenStatus } from '@/types/entities';
import { SCREEN_STATUSES } from '../constants';
import type { ScreenForm } from '../types/signage.types';

interface ScreenFormModalProps {
  mode: 'create' | 'edit';
  form: ScreenForm;
  setForm: React.Dispatch<React.SetStateAction<ScreenForm>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function ScreenFormModal({ mode, form, setForm, saving, onClose, onSubmit }: ScreenFormModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('signage.addScreenTitle') : t('signage.editScreenTitle')}>
      <div className="space-y-3">
        <Input
          id="screen-name"
          label={t('signage.nameLabel')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="screen-location"
          label={t('signage.locationLabel')}
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
        <Input
          id="screen-device-id"
          label={t('signage.deviceIdLabel')}
          value={form.device_id}
          onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
        />
        <Select
          label={t('signage.statusLabel')}
          value={form.status}
          options={SCREEN_STATUSES.map((s) => ({ label: t(`signage.screenStatus.${s}`), value: s }))}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ScreenStatus }))}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={saving} disabled={!form.name.trim()} onClick={onSubmit}>
            {t('signage.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
