import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/redux';
import { toggleCombo } from '../store/bookingSlice';
import type { Combo } from '@/types/entities';

export function ComboSelector({ combos, selectedComboIds }: { combos: Combo[]; selectedComboIds: number[] }) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();

  if (combos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('bookSeat.combo.title')}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {combos.map((combo) => (
          <label
            key={combo.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm text-txt/80 transition-colors hover:border-accent/60"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedComboIds.includes(combo.id)}
                onChange={() => dispatch(toggleCombo(combo.id))}
              />
              {combo.name}
            </span>
            <span className="font-medium text-white">
              {combo.price.toLocaleString()}đ
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
