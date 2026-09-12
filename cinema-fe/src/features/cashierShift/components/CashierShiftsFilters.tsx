import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { CASHIER_SHIFT_STATUS, CASHIER_SHIFT_STATUS_META } from '@/constants/cashierShiftStatus';

export function CashierShiftsFilters({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (status: string) => void;
}) {
  const { t } = useTranslation('cashierShift');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-56">
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('statusFilterPlaceholder')}
          options={Object.values(CASHIER_SHIFT_STATUS).map((value) => ({
            label: t(`status.${CASHIER_SHIFT_STATUS_META[value].key}`),
            value,
          }))}
        />
      </div>
    </div>
  );
}
