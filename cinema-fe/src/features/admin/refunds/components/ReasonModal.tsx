import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import type { ReasonModalState } from '../types/adminRefund.types';

export interface ReasonModalProps {
  reasonModal: ReasonModalState | null;
  reasonText: string;
  onReasonTextChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const ReasonModal = ({
  reasonModal,
  reasonText,
  onReasonTextChange,
  onClose,
  onSubmit,
  isSubmitting,
}: ReasonModalProps) => {
  const { t } = useTranslation('admin');

  return (
    <Modal
      open={reasonModal !== null}
      onClose={onClose}
      title={reasonModal?.kind === 'reject' ? t('refunds.rejectModalTitle') : t('refunds.failModalTitle')}
    >
      <Textarea
        label={t('refunds.reasonLabel')}
        value={reasonText}
        onChange={(e) => onReasonTextChange(e.target.value)}
        rows={4}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={isSubmitting}
          disabled={!reasonText.trim()}
          onClick={onSubmit}
        >
          {t('common:actions.confirm')}
        </Button>
      </div>
    </Modal>
  );
};
