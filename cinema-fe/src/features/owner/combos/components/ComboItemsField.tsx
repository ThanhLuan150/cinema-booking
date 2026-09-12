import { useTranslation } from 'react-i18next';
import { useComboComponents } from '../../hooks/useComboComponents';
import type { ComboFormValues } from '../../types/owner.types';

interface ComboItemsFieldProps {
  cinemaId: string;
  type: ComboFormValues['type'];
  items: Record<number, number>;
  onChange: (items: Record<number, number>) => void;
}

// Only relevant when type === 'COMBO': lets the owner pick which FOOD/BEVERAGE items (and how
// many of each) this combo bundles together, from that branch's own catalog.
export function ComboItemsField({ cinemaId, type, items, onChange }: ComboItemsFieldProps) {
  const { t } = useTranslation('owner');
  const { data } = useComboComponents(cinemaId || undefined);
  const components = (data?.data ?? []).filter((combo) => combo.type !== 'COMBO');

  if (type !== 'COMBO') return null;
  if (!cinemaId) {
    return <p className="mt-3 text-sm text-txt/60">{t('combos.itemsSelectCinemaFirst')}</p>;
  }
  if (components.length === 0) {
    return <p className="mt-3 text-sm text-txt/60">{t('combos.itemsNone')}</p>;
  }

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-txt/90">{t('combos.itemsLabel')}</p>
      <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
        {components.map((component) => (
          <div
            key={component.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="text-sm text-txt">
              {component.name}{' '}
              <span className="text-txt/50">
                ({component.type === 'FOOD' ? t('combos.typeFood') : t('combos.typeBeverage')})
              </span>
            </span>
            <input
              type="number"
              min={0}
              value={items[component.id] ?? 0}
              onChange={(e) => onChange({ ...items, [component.id]: Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-lg border border-border-strong bg-surface-soft px-2 py-1.5 text-right text-txt"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
