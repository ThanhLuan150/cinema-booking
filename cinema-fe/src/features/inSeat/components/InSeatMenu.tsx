import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { InSeatMenuItem } from '../types/inSeat.types';
import { MAX_LINE_QUANTITY, type InSeatCart } from '../utils/inSeatCart';

export interface InSeatMenuProps {
  menu: InSeatMenuItem[];
  cart: InSeatCart;
  disabled: boolean;
  onIncrement: (comboId: number) => void;
  onDecrement: (comboId: number) => void;
}

const TYPE_ORDER: InSeatMenuItem['type'][] = ['COMBO', 'FOOD', 'BEVERAGE'];

export function InSeatMenu({ menu, cart, disabled, onIncrement, onDecrement }: InSeatMenuProps) {
  const { t } = useTranslation('inSeat');
  if (menu.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-txt/60">
        {t('menu.empty')}
      </p>
    );
  }

  const groups = TYPE_ORDER.map((type) => ({
    type,
    items: menu.filter((item) => item.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <section aria-label={t('menu.title')} className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.type} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
            {t(`menu.type.${group.type}`)}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => {
              const quantity = cart[item.id] ?? 0;
              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-surface p-3 transition-colors',
                    quantity > 0 ? 'border-accent/70' : 'border-border',
                  )}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-txt/40">
                      <i className="fa-solid fa-utensils" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{item.name}</p>
                    {item.description && (
                      <p className="line-clamp-2 text-xs text-txt/60">{item.description}</p>
                    )}
                    <p className="text-sm font-semibold text-accent">
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('menu.remove', { name: item.name })}
                      disabled={disabled || quantity === 0}
                      onClick={() => onDecrement(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-lg text-txt disabled:opacity-30"
                    >
                      −
                    </button>
                    <span
                      className="w-6 text-center font-bold tabular-nums"
                      aria-label={t('menu.quantity', { count: quantity, name: item.name })}
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={t('menu.add', { name: item.name })}
                      disabled={disabled || quantity >= MAX_LINE_QUANTITY}
                      onClick={() => onIncrement(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg text-white disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
