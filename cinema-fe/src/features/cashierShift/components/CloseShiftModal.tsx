import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import type { CashierShiftDetailResponse } from '../types/cashierShift.types';
import { money } from '../utils/format';

export function CloseShiftModal({
  open,
  closeDetail,
  actualCash,
  note,
  submitPending,
  onActualCashChange,
  onNoteChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  closeDetail: CashierShiftDetailResponse | undefined;
  actualCash: string;
  note: string;
  submitPending: boolean;
  onActualCashChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('cashierShift');
  return (
    <Modal open={open} onClose={onClose} title={t('currentShift.closeModalTitle')}>
      {closeDetail?.reconciliation && (
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-txt/60">{t('reconciliation.openingCash')}</dt>
            <dd>{money(closeDetail.reconciliation.openingCash)}</dd>
          </div>
          <div>
            <dt className="text-txt/60">{t('reconciliation.cashSales')}</dt>
            <dd>{money(closeDetail.reconciliation.cashSales)}</dd>
          </div>
          <div>
            <dt className="text-txt/60">{t('reconciliation.cashRefunds')}</dt>
            <dd>{money(closeDetail.reconciliation.cashRefunds)}</dd>
          </div>
          <div>
            <dt className="text-txt/60">{t('reconciliation.expectedCash')}</dt>
            <dd className="font-semibold text-accent">{money(closeDetail.reconciliation.expectedCash)}</dd>
          </div>
        </dl>
      )}
      <div className="flex flex-col gap-4">
        <Input
          label={t('currentShift.actualCashLabel')}
          type="number"
          min={0}
          value={actualCash}
          onChange={(e) => onActualCashChange(e.target.value)}
          placeholder={t('currentShift.actualCashPlaceholder')}
        />
        <Textarea
          label={t('currentShift.closeNoteLabel')}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={submitPending}
          disabled={!actualCash || Number(actualCash) < 0}
          onClick={onSubmit}
        >
          {t('currentShift.closeSubmit')}
        </Button>
      </div>
    </Modal>
  );
}
