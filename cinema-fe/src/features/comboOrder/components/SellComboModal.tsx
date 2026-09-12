import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Combo, Cinema } from '@/types/entities';

export function SellComboModal({
  open,
  needsBranchPicker,
  branchId,
  branches,
  effectiveBranchId,
  sellableCombos,
  quantities,
  totalQuantity,
  submitPending,
  onBranchChange,
  onQuantityChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  needsBranchPicker: boolean;
  branchId: string;
  branches: Cinema[];
  effectiveBranchId: number | null;
  sellableCombos: Combo[];
  quantities: Record<number, number>;
  totalQuantity: number;
  submitPending: boolean;
  onBranchChange: (branchId: string) => void;
  onQuantityChange: (comboId: number, quantity: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('comboOrder');
  return (
    <Modal open={open} onClose={onClose} title={t('sellModalTitle')}>
      {needsBranchPicker && (
        <Select
          label={t('sellBranchLabel')}
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('sellBranchPlaceholder')}
          options={branches.map((branch) => ({ label: branch.name, value: branch.id }))}
        />
      )}
      {!effectiveBranchId ? (
        <p className="mt-3 text-sm text-txt/60">{t('sellSelectBranchFirst')}</p>
      ) : sellableCombos.length === 0 ? (
        <p className="mt-3 text-sm text-txt/60">{t('noItems')}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {sellableCombos.map((combo) => (
            <div key={combo.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-txt">{combo.name}</p>
                <p className="text-xs text-txt/60">{combo.price.toLocaleString()}đ</p>
              </div>
              <input
                type="number"
                min={0}
                value={quantities[combo.id] ?? 0}
                onChange={(e) => onQuantityChange(combo.id, Number(e.target.value))}
                className="w-20 rounded-lg border border-border-strong bg-surface-soft px-2 py-1.5 text-right text-txt"
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={submitPending}
          disabled={totalQuantity === 0 || !effectiveBranchId}
          onClick={onSubmit}
        >
          {t('sellSubmit')}
        </Button>
      </div>
    </Modal>
  );
}
