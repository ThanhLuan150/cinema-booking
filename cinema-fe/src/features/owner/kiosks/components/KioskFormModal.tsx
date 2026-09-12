import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Kiosk, KioskStatus } from '@/types/entities';
import type { KioskForm } from '../../types/owner.types';
import { KIOSK_STATUSES } from '../constants';

interface KioskFormModalProps {
  mode: 'create' | 'edit';
  kiosk?: Kiosk;
  form: KioskForm;
  onFormChange: (form: KioskForm) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function KioskFormModal({ mode, form, onFormChange, isSubmitting, onClose, onSubmit }: KioskFormModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('kiosks.addTitle') : t('kiosks.editTitle')}>
      <div className="space-y-3">
        <Input
          id="kiosk-form-code"
          label={t('kiosks.kioskCodeLabel')}
          value={form.kiosk_code}
          disabled={mode === 'edit'}
          onChange={(e) => onFormChange({ ...form, kiosk_code: e.target.value })}
        />
        <Input
          id="kiosk-form-name"
          label={t('kiosks.nameLabel')}
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
        />
        <Select
          label={t('kiosks.statusLabel')}
          value={form.status}
          options={KIOSK_STATUSES.map((s: KioskStatus) => ({ label: t(`kiosks.status.${s}`), value: s }))}
          onChange={(e) => onFormChange({ ...form, status: e.target.value as KioskStatus })}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={isSubmitting}
            disabled={!form.kiosk_code.trim() || !form.name.trim()}
            onClick={onSubmit}
          >
            {t('kiosks.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
