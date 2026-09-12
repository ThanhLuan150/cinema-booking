import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { KioskCombo } from '../types/kiosk.types';

export function ComboStep({
  combos,
  comboIds,
  onToggleCombo,
  onSkip,
  onNext,
}: {
  combos: KioskCombo[];
  comboIds: number[];
  onToggleCombo: (comboId: number) => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.combo')}</h2>
      <div className="flex flex-col gap-2">
        {combos.map((combo) => (
          <label
            key={combo.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-4 py-3 text-sm text-txt/80"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={comboIds.includes(combo.id)}
                onChange={() => onToggleCombo(combo.id)}
              />
              {combo.name}
            </span>
            <span className="font-medium text-white">{combo.price.toLocaleString()}đ</span>
          </label>
        ))}
        {combos.length === 0 && <p className="text-sm text-txt/60">{t('empty.combos')}</p>}
      </div>
      <div className="mt-6 flex gap-3">
        <Button type="button" variant="outline" onClick={onSkip}>
          {t('skip')}
        </Button>
        <Button type="button" variant="danger" onClick={onNext}>
          {t('next')}
        </Button>
      </div>
    </section>
  );
}
