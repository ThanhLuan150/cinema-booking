import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export function CancelOrderModal({
  open,
  reason,
  submitPending,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  reason: string;
  submitPending: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('comboOrder');
  return (
    <Modal open={open} onClose={onClose} title={t('cancelModalTitle')}>
      <Textarea label={t('cancelReasonLabel')} value={reason} onChange={(e) => onReasonChange(e.target.value)} rows={4} />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button type="button" variant="danger" loading={submitPending} onClick={onSubmit}>
          {t('common:actions.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
