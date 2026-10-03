import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { KdsOrder, KdsTargetStatus } from '../types/kds.types';
import { dropTargetFor, type KdsLane } from '../utils/kdsBoard';

/** How far the pointer must travel before a press becomes a drag (a shorter move is a tap/click). */
export const KDS_DRAG_THRESHOLD_PX = 6;

export interface KdsDragState {
  order: KdsOrder;
  /** The only lane this card may be dropped into, and the status that drop means. */
  lane: KdsLane;
  status: KdsTargetStatus;
  x: number;
  y: number;
  /** Grab point inside the card, so the floating copy stays under the finger/cursor where it was picked up. */
  offsetX: number;
  offsetY: number;
  width: number;
  /** Lane currently under the pointer, if any. */
  over: KdsLane | null;
}

interface PendingPress extends Omit<KdsDragState, 'x' | 'y' | 'over'> {
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean;
}

/** The lane under a screen point: lanes carry `data-kds-lane`; the floating copy is pointer-events:none. */
export function laneAtPoint(x: number, y: number): KdsLane | null {
  const element = document.elementFromPoint?.(x, y) as HTMLElement | null | undefined;
  const lane = element?.closest<HTMLElement>('[data-kds-lane]')?.dataset.kdsLane;
  return (lane as KdsLane | undefined) ?? null;
}

const INTERACTIVE = 'button, a, input, textarea, select, [role="listbox"]';

/**
 * Drag-to-advance for KDS cards, on Pointer Events so it works the same with a mouse, a pen and a
 * finger on the kitchen tablet (HTML5 drag-and-drop does not fire for touch). Cards set
 * `touch-action: pan-y`, so a vertical swipe still scrolls the lane (the browser then cancels the
 * pointer) while a sideways drag moves the card. Pressing a button never starts a drag, and a press
 * that moves less than the threshold stays a normal tap/click.
 */
export function useKdsDrag({
  enabled,
  onDrop,
}: {
  enabled: boolean;
  onDrop: (order: KdsOrder, status: KdsTargetStatus) => void;
}) {
  const [drag, setDrag] = useState<KdsDragState | null>(null);
  const pressRef = useRef<PendingPress | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const detachRef = useRef<(() => void) | null>(null);

  const finish = useCallback(() => {
    detachRef.current?.();
    detachRef.current = null;
    pressRef.current = null;
    setDrag(null);
  }, []);

  useEffect(() => finish, [finish]);

  const startPress = useCallback(
    (order: KdsOrder) => (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || pressRef.current) return;
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
      const target = dropTargetFor(order);
      if (!target) return;

      const rect = event.currentTarget.getBoundingClientRect();
      pressRef.current = {
        order,
        ...target,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        started: false,
      };

      const move = (ev: PointerEvent) => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;
        if (!press.started) {
          const distance = Math.hypot(ev.clientX - press.startX, ev.clientY - press.startY);
          if (distance < KDS_DRAG_THRESHOLD_PX) return;
          press.started = true;
        }
        ev.preventDefault(); // no text selection while dragging with a mouse
        setDrag({
          order: press.order,
          lane: press.lane,
          status: press.status,
          offsetX: press.offsetX,
          offsetY: press.offsetY,
          width: press.width,
          x: ev.clientX,
          y: ev.clientY,
          over: laneAtPoint(ev.clientX, ev.clientY),
        });
      };
      const up = (ev: PointerEvent) => {
        const press = pressRef.current;
        if (!press || ev.pointerId !== press.pointerId) return;
        const dropped = press.started && laneAtPoint(ev.clientX, ev.clientY) === press.lane;
        finish();
        if (dropped) onDropRef.current(press.order, press.status);
      };
      const cancel = (ev: PointerEvent) => {
        if (pressRef.current && ev.pointerId === pressRef.current.pointerId) finish();
      };
      const escape = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') finish();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', escape);
      detachRef.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', escape);
      };
    },
    [enabled, finish],
  );

  return { drag, startPress };
}
