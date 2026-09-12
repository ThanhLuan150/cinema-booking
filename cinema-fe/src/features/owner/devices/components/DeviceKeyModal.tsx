import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface DeviceKeyModalProps {
  deviceId: string;
  apiKey: string;
  onClose: () => void;
}

export function DeviceKeyModal({ deviceId, apiKey, onClose }: DeviceKeyModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('devices.keyTitle')}>
      <p className="text-sm text-txt/70">{t('devices.keyHint', { deviceId })}</p>
      <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">{apiKey}</code>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('devices.keyDone')}
        </Button>
      </div>
    </Modal>
  );
}
