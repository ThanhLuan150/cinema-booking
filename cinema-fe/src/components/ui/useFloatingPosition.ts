import { useEffect, useLayoutEffect, type RefObject } from 'react';

export interface FloatingPosition {
  top: number;
  left: number;
  width: number;
}

// Positions a portaled dropdown (rendered into document.body) under its trigger, using
// position: fixed anchored to real viewport coordinates. This is what lets the dropdown render
// inside a Modal (or any other scrolling ancestor) without being clipped, and without its
// overflow being counted into that ancestor's scrollable area — an `absolute` child would be
// clipped/would push the ancestor's layout open instead of simply floating on top of it.
//
// When there isn't enough room below the trigger to fit the dropdown but there is above, it
// flips to render above instead (the common "collision" behavior of floating popovers).
//
// `dropdownRef` starts out unmounted the first time this runs (the dropdown only renders once
// `position` is set), so the first pass measures a height of 0 and places below by default;
// once the dropdown mounts, `position` changing re-runs the layout effect and the real
// measured height corrects the placement — synchronously, before the browser paints, so there
// is no visible flicker.
export function useFloatingPosition(
  isOpen: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  dropdownRef: RefObject<HTMLElement | null>,
  position: FloatingPosition | null,
  setPosition: (position: FloatingPosition) => void,
  extraDeps: unknown[] = [],
) {
  const compute = (): FloatingPosition | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const dropdownHeight = dropdownRef.current?.getBoundingClientRect().height ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom;
    const fitsBelow = dropdownHeight === 0 || spaceBelow >= dropdownHeight + 8;
    const flipUp = !fitsBelow && rect.top > dropdownHeight + 8;
    const top = flipUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4;
    return { top, left: rect.left, width: rect.width };
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const next = compute();
    if (!next) return;
    if (position && position.top === next.top && position.left === next.left && position.width === next.width) {
      return;
    }
    setPosition(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, position, ...extraDeps]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = () => {
      const next = compute();
      if (next) setPosition(next);
    };
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
