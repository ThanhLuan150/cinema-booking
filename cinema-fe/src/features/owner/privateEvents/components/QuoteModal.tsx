import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import type { PrivateEvent } from '@/types/entities';
import { formatDateOrDash } from '../constants';

interface QuoteModalProps {
  event: PrivateEvent;
  amount: string;
  onAmountChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function QuoteModal({
  event,
  amount,
  onAmountChange,
  notes,
  onNotesChange,
  isSubmitting,
  onClose,
  onSubmit,
}: QuoteModalProps) {
  const { t } = useTranslation('privateEvents');

  return (
    <Modal open onClose={onClose} title={t('admin.quoteTitle', { id: event.id })}>
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm text-txt/75">
          <p>{t('mine.window', { start: formatDateOrDash(event.start_at), end: formatDateOrDash(event.end_at) })}</p>
          <p className="text-xs text-txt/55">
            {t('mine.meta', { branch: event.branch_id, room: event.room_id, guests: event.guest_count })}
          </p>
          {event.notes && <p className="mt-1 italic">“{event.notes}”</p>}
        </div>
        <Input
          id="pe-quote-amount"
          type="number"
          min={0}
          label={t('admin.amount')}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
        <Textarea
          id="pe-quote-notes"
          rows={3}
          label={t('admin.quoteNotes')}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <div className="flex justify-end pt-1">
          <Button type="button" variant="danger" loading={isSubmitting} onClick={onSubmit}>
            {t('admin.sendQuote')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
