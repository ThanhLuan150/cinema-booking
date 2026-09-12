import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { COMBO_ORDER_STATUS, COMBO_ORDER_STATUS_META } from '@/constants/comboOrderStatus';

export function ComboOrdersFilters({
  status,
  canSell,
  onStatusChange,
  onSell,
}: {
  status: string;
  canSell: boolean;
  onStatusChange: (status: string) => void;
  onSell: () => void;
}) {
  const { t } = useTranslation('comboOrder');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-56">
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('statusFilterPlaceholder')}
          options={Object.values(COMBO_ORDER_STATUS).map((value) => ({
            label: t(`status.${COMBO_ORDER_STATUS_META[value].key}`),
            value,
          }))}
        />
      </div>
      {canSell && (
        <Button type="button" variant="danger" onClick={onSell}>
          {t('sellButton')}
        </Button>
      )}
    </div>
  );
}
