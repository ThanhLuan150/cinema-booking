import { useTranslation } from 'react-i18next';
import type { Combo } from '@/types/entities';

export function BoxOfficeComboSelection({
  combos,
  comboIds,
  onToggleCombo,
}: {
  combos: Combo[];
  comboIds: number[];
  onToggleCombo: (comboId: number) => void;
}) {
  const { t } = useTranslation('employee');
  if (combos.length === 0) return null;
  return (
    <div className="mt-6 max-w-md">
      <h6 className="mb-3 font-semibold text-white">{t('boxOffice.comboTitle')}</h6>
      <div className="flex flex-col gap-2">
        {combos.map((combo) => (
          <label
            key={combo.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm text-txt/80"
          >
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={comboIds.includes(combo.id)} onChange={() => onToggleCombo(combo.id)} />
              {combo.name}
            </span>
            <span className="font-medium text-white">{combo.price.toLocaleString()}đ</span>
          </label>
        ))}
      </div>
    </div>
  );
}
