import { describe, expect, it } from 'vitest';
import { formatClock, formatMinutes, toOffsetTimestamp } from './format';

describe('formatClock', () => {
  it('renders the instant on the branch wall clock, whatever the browser zone is', () => {
    // 2026-09-26T18:30:00Z is 01:30 the next morning in Vietnam and 07:30 in Pago Pago.
    expect(formatClock('2026-09-26T18:30:00Z', 'Asia/Ho_Chi_Minh')).toMatch(/^0?1[:.]30/);
    expect(formatClock('2026-09-26T18:30:00Z', 'Pacific/Pago_Pago')).toMatch(/^0?7[:.]30/);
  });

  it('shows a dash for a missing or unparseable time', () => {
    expect(formatClock(null, 'UTC')).toBe('—');
    expect(formatClock(undefined, 'UTC')).toBe('—');
    expect(formatClock('not a date', 'UTC')).toBe('—');
  });

  it('does not throw on an unknown timezone', () => {
    expect(formatClock('2026-09-26T18:30:00Z', 'Nowhere/Land')).not.toBe('—');
  });
});

describe('formatMinutes', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(450)).toBe('7h 30m');
  });

  it('treats missing or negative values as zero', () => {
    expect(formatMinutes(null)).toBe('0m');
    expect(formatMinutes(undefined)).toBe('0m');
    expect(formatMinutes(-5)).toBe('0m');
  });
});

describe('toOffsetTimestamp', () => {
  it('attaches the zone’s offset so the backend never has to guess', () => {
    expect(toOffsetTimestamp('2026-09-10', '17:30', 'Asia/Ho_Chi_Minh')).toBe('2026-09-10T17:30:00+07:00');
    expect(toOffsetTimestamp('2026-09-10', '17:30', 'Pacific/Pago_Pago')).toBe('2026-09-10T17:30:00-11:00');
    expect(toOffsetTimestamp('2026-09-10', '05:00', 'Asia/Kolkata')).toBe('2026-09-10T05:00:00+05:30');
    expect(toOffsetTimestamp('2026-09-10', '09:00', 'UTC')).toBe('2026-09-10T09:00:00+00:00');
  });

  it('denotes the intended instant', () => {
    expect(new Date(toOffsetTimestamp('2026-09-10', '17:30', 'Asia/Ho_Chi_Minh') as string).toISOString()).toBe(
      '2026-09-10T10:30:00.000Z',
    );
  });

  it('follows daylight saving', () => {
    expect(toOffsetTimestamp('2026-01-15', '12:00', 'America/New_York')).toBe('2026-01-15T12:00:00-05:00');
    expect(toOffsetTimestamp('2026-07-15', '12:00', 'America/New_York')).toBe('2026-07-15T12:00:00-04:00');
    // the morning of the spring-forward day is still standard time; the evening is daylight time
    expect(toOffsetTimestamp('2026-03-08', '01:00', 'America/New_York')).toBe('2026-03-08T01:00:00-05:00');
    expect(toOffsetTimestamp('2026-03-08', '12:00', 'America/New_York')).toBe('2026-03-08T12:00:00-04:00');
  });

  it('returns null for anything that is not a real date, time or zone', () => {
    expect(toOffsetTimestamp('2026-02-30', '10:00', 'UTC')).toBeNull();
    expect(toOffsetTimestamp('2026-09-10', '24:00', 'UTC')).toBeNull();
    expect(toOffsetTimestamp('2026-09-10', '10:60', 'UTC')).toBeNull();
    expect(toOffsetTimestamp('10/09/2026', '10:00', 'UTC')).toBeNull();
    expect(toOffsetTimestamp('2026-09-10', '10am', 'UTC')).toBeNull();
    expect(toOffsetTimestamp('2026-09-10', '10:00', 'Nowhere/Land')).toBeNull();
    expect(toOffsetTimestamp('2026-09-10', '10:00', '')).toBeNull();
  });
});
