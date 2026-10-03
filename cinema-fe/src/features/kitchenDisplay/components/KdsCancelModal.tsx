import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { KdsOrder } from '../types/kds.types';

const MAX_REASON_LENGTH = 300; // mirrors the server's limit (utils/kdsStatus.js)

export interface KdsCancelModalProps {
  order: KdsOrder | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (order: KdsOrder, reason: string) => void;
}

// A paid order cancelled from the kitchen is money the counter has to deal with, so the reason is
// mandatory (the server refuses a blank one too).
export function KdsCancelModal({ order, pending, onClose, onSubmit }: KdsCancelModalProps) {
  const { t } = useTranslation('kitchenDisplay');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setReason('');
    setTouched(false);
  }, [order?.id]);

  if (!order) return null;
  const trimmed = reason.trim();
  const error = touched && !trimmed ? t('cancelModal.reasonRequired') : undefined;

  return (
    <Modal open onClose={onClose} title={t('cancelModal.title', { code: order.code })}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (trimmed) onSubmit(order, trimmed);
        }}
      >
        <Textarea
          id="kds-cancel-reason"
          label={t('cancelModal.reasonLabel')}
          placeholder={t('cancelModal.reasonPlaceholder')}
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          rows={3}
          error={error}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancelModal.back')}
          </Button>
          <Button type="submit" variant="danger" loading={pending}>
            {t('cancelModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
