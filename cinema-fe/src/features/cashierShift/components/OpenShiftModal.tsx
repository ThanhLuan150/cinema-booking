import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

export function OpenShiftModal({
  open,
  openingCash,
  note,
  submitPending,
  onOpeningCashChange,
  onNoteChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  openingCash: string;
  note: string;
  submitPending: boolean;
  onOpeningCashChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('cashierShift');
  return (
    <Modal open={open} onClose={onClose} title={t('currentShift.openModalTitle')}>
      <div className="flex flex-col gap-4">
        <Input
          label={t('currentShift.openingCashLabel')}
          type="number"
          min={0}
          value={openingCash}
          onChange={(e) => onOpeningCashChange(e.target.value)}
          placeholder={t('currentShift.openingCashPlaceholder')}
        />
        <Textarea label={t('currentShift.noteLabel')} value={note} onChange={(e) => onNoteChange(e.target.value)} rows={3} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={submitPending}
          disabled={!openingCash || Number(openingCash) < 0}
          onClick={onSubmit}
        >
          {t('currentShift.openSubmit')}
        </Button>
      </div>
    </Modal>
  );
}
