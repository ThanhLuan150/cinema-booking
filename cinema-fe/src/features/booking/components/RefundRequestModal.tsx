import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export function RefundRequestModal({
  open,
  reason,
  onChangeReason,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  reason: string;
  onChangeReason: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation('booking');

  return (
    <Modal open={open} onClose={onClose} title={t('bookingManagement.refundModalTitle')}>
      <Textarea
        label={t('bookingManagement.refundReasonLabel')}
        value={reason}
        onChange={(e) => onChangeReason(e.target.value)}
        rows={3}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button type="button" variant="danger" loading={submitting} onClick={onSubmit}>
          {t('common:actions.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
