import { describe, expect, it } from 'vitest';
import { isSlotBlocked } from './slotConflict';

describe('isSlotBlocked', () => {
  const existing = [{ time_begin: '10:00', time_end: '12:00', status: 'ACTIVE' as const }];

  it('blocks a slot that overlaps an existing schedule', () => {
    expect(isSlotBlocked('11:00', '13:00', existing)).toBe(true);
  });

  it('blocks a slot starting too soon after an existing schedule ends', () => {
    expect(isSlotBlocked('12:10', '14:00', existing)).toBe(true);
  });

  it('blocks a slot ending too close to when an existing schedule begins', () => {
    expect(isSlotBlocked('08:00', '09:50', existing)).toBe(true);
  });

  it('allows a slot with at least the buffer gap after an existing schedule', () => {
    expect(isSlotBlocked('12:15', '14:00', existing)).toBe(false);
  });

  it('allows a slot with at least the buffer gap before an existing schedule', () => {
    expect(isSlotBlocked('08:00', '09:45', existing)).toBe(false);
  });

  it('ignores a cancelled schedule', () => {
    const cancelled = [{ time_begin: '10:00', time_end: '12:00', status: 'CANCELLED' as const }];
    expect(isSlotBlocked('12:05', '14:00', cancelled)).toBe(false);
  });

  it('respects a custom bufferMinutes override', () => {
    expect(isSlotBlocked('12:05', '14:00', existing, 30)).toBe(true);
  });

  it('returns false when there are no existing schedules', () => {
    expect(isSlotBlocked('09:00', '11:00', [])).toBe(false);
  });
});
