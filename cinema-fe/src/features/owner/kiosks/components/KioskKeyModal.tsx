import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface KioskKeyModalProps {
  kioskCode: string;
  apiKey: string;
  onClose: () => void;
}

export function KioskKeyModal({ kioskCode, apiKey, onClose }: KioskKeyModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('kiosks.keyTitle')}>
      <p className="text-sm text-txt/70">{t('kiosks.keyHint', { kioskCode })}</p>
      <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">
        {apiKey}
      </code>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('kiosks.keyDone')}
        </Button>
      </div>
    </Modal>
  );
}
