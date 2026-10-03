import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { KdsDragState } from '../hooks/useKdsDrag';
import { KDS_STATUS_CLASS } from '../utils/kdsBoard';

// The copy of a card that follows the pointer while it is dragged. pointer-events:none so the lane
// under the pointer (not this copy) is what hit-testing finds.
export function KdsDragGhost({ drag }: { drag: KdsDragState }) {
  const { t } = useTranslation('kitchenDisplay');
  const onTarget = drag.over === drag.lane;
  return createPortal(
    <div
      aria-hidden="true"
      data-testid="kds-drag-ghost"
      className={cn(
        'pointer-events-none fixed z-50 flex rotate-1 flex-col gap-2 rounded-xl border-2 bg-surface-raised p-4 shadow-raised',
        onTarget ? 'border-accent' : 'border-border-strong',
      )}
      style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold tracking-wide">{drag.order.code}</span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            KDS_STATUS_CLASS[drag.order.status],
          )}
        >
          {t(`status.${drag.order.status}`)}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {drag.order.items.map((item) => (
          <li key={`${item.combo_id}-${item.name}`}>
            <strong className="tabular-nums">{item.quantity}×</strong> {item.name}
          </li>
        ))}
      </ul>
      <p className={cn('text-xs font-semibold', onTarget ? 'text-accent' : 'text-txt/60')}>
        {t(`drop.${drag.status}`)}
      </p>
    </div>,
    document.body,
  );
}
