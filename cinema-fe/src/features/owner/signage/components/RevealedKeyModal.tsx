import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface RevealedKeyModalProps {
  revealedKey: { name: string; api_key: string };
  onClose: () => void;
}

export function RevealedKeyModal({ revealedKey, onClose }: RevealedKeyModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('signage.keyTitle')}>
      <p className="text-sm text-txt/70">{t('signage.keyHint', { name: revealedKey.name })}</p>
      <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">
        {revealedKey.api_key}
      </code>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('signage.keyDone')}
        </Button>
      </div>
    </Modal>
  );
}
