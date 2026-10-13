import { useTranslation } from 'react-i18next';
import type { Combo } from '@/types/entities';
import type { GroupComboLine } from '../types/groupBooking.types';
import { MAX_COMBO_QUANTITY, comboQuantity } from '../utils/groupOrder';

const formatVnd = (value: number) => `${value.toLocaleString()}đ`;

/** Food & drinks for the whole group, by quantity (e.g. 5 popcorn, 10 drinks). */
export function GroupComboPicker({
  combos,
  lines,
  onChange,
}: {
  combos: Combo[];
  lines: GroupComboLine[];
  onChange: (comboId: number, quantity: number) => void;
}) {
  const { t } = useTranslation('groupBooking');
  if (combos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-1 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('combos.title')}
      </h2>
      <p className="mb-4 text-sm text-txt/60">{t('combos.hint')}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {combos.map((combo) => {
          const quantity = comboQuantity(lines, combo.id);
          return (
            <li
              key={combo.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">{combo.name}</span>
                <span className="text-txt/60">{formatVnd(combo.price)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={t('combos.decrease', { name: combo.name })}
                  className="h-8 w-8 rounded-full border border-border-strong text-txt disabled:opacity-40"
                  disabled={quantity === 0}
                  onClick={() => onChange(combo.id, quantity - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_COMBO_QUANTITY}
                  aria-label={t('combos.quantity', { name: combo.name })}
                  className="w-14 rounded-lg border border-border-strong bg-surface-soft px-2 py-1 text-center text-txt"
                  value={quantity}
                  onChange={(event) => onChange(combo.id, Number(event.target.value))}
                />
                <button
                  type="button"
                  aria-label={t('combos.increase', { name: combo.name })}
                  className="h-8 w-8 rounded-full border border-border-strong text-txt disabled:opacity-40"
                  disabled={quantity >= MAX_COMBO_QUANTITY}
                  onClick={() => onChange(combo.id, quantity + 1)}
                >
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
