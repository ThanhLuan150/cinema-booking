import { describe, expect, it } from 'vitest';
import type { KdsOrder, KdsStatus } from '../types/kds.types';
import {
  canCancel,
  dropTargetFor,
  formatClock,
  groupOrdersByLane,
  laneOf,
  minutesSince,
  pickDefaultBranchId,
  primaryNextStatus,
  serverClockOffset,
  urgencyOf,
} from './kdsBoard';

const NOW = Date.parse('2026-10-02T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function order(id: number, status: KdsStatus, overrides: Partial<KdsOrder> = {}): KdsOrder {
  const next: Record<KdsStatus, KdsOrder['next_statuses']> = {
    NEW: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  return {
    id,
    code: `CO-${id}`,
    branch_id: 1,
    status,
    items: [{ combo_id: 1, name: 'Popcorn', quantity: 1 }],
    item_count: 1,
    created_at: minutesAgo(5),
    status_changed_at: minutesAgo(1),
    timestamps: {
      NEW: minutesAgo(5),
      PREPARING: null,
      READY: null,
      COMPLETED: null,
      CANCELLED: null,
    },
    customer: null,
    booking: null,
    cancel_reason: null,
    next_statuses: next[status],
    ...overrides,
  };
}

describe('groupOrdersByLane', () => {
  it('puts active orders in their own lane, oldest payment first, and finished ones in DONE newest first', () => {
    const lanes = groupOrdersByLane([
      order(1, 'NEW', {
        timestamps: {
          NEW: minutesAgo(2),
          PREPARING: null,
          READY: null,
          COMPLETED: null,
          CANCELLED: null,
        },
      }),
      order(2, 'NEW', {
        timestamps: {
          NEW: minutesAgo(9),
          PREPARING: null,
          READY: null,
          COMPLETED: null,
          CANCELLED: null,
        },
      }),
      order(3, 'PREPARING'),
      order(4, 'READY'),
      order(5, 'COMPLETED', { status_changed_at: minutesAgo(30) }),
      order(6, 'CANCELLED', { status_changed_at: minutesAgo(3) }),
    ]);
    expect(lanes.NEW.map((o) => o.id)).toEqual([2, 1]);
    expect(lanes.PREPARING.map((o) => o.id)).toEqual([3]);
    expect(lanes.READY.map((o) => o.id)).toEqual([4]);
    expect(lanes.DONE.map((o) => o.id)).toEqual([6, 5]);
  });

  it('returns empty lanes for an empty board', () => {
    expect(groupOrdersByLane([])).toEqual({ NEW: [], PREPARING: [], READY: [], DONE: [] });
  });
});

describe('minutesSince / urgencyOf', () => {
  it('counts whole minutes and never goes negative', () => {
    expect(minutesSince(minutesAgo(12.9), NOW)).toBe(12);
    expect(minutesSince(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0);
    expect(minutesSince(null, NOW)).toBe(0);
    expect(minutesSince('garbage', NOW)).toBe(0);
  });

  it('flags an active order amber after 10 min and red after 20 min of waiting since payment', () => {
    const waited = (m: number) =>
      order(1, 'PREPARING', {
        timestamps: {
          NEW: minutesAgo(m),
          PREPARING: minutesAgo(1),
          READY: null,
          COMPLETED: null,
          CANCELLED: null,
        },
      });
    expect(urgencyOf(waited(9), NOW)).toBe('normal');
    expect(urgencyOf(waited(10), NOW)).toBe('warning');
    expect(urgencyOf(waited(20), NOW)).toBe('late');
  });

  it('never flags a finished order', () => {
    const old = {
      NEW: minutesAgo(90),
      PREPARING: null,
      READY: null,
      COMPLETED: minutesAgo(1),
      CANCELLED: null,
    };
    expect(urgencyOf(order(1, 'COMPLETED', { timestamps: old }), NOW)).toBe('normal');
  });
});

describe('actions', () => {
  it('derives the main button and the cancel button from the server next_statuses', () => {
    expect(primaryNextStatus(order(1, 'NEW'))).toBe('PREPARING');
    expect(primaryNextStatus(order(1, 'PREPARING'))).toBe('READY');
    expect(primaryNextStatus(order(1, 'READY'))).toBe('COMPLETED');
    expect(primaryNextStatus(order(1, 'COMPLETED'))).toBeNull();
    expect(canCancel(order(1, 'NEW'))).toBe(true);
    expect(canCancel(order(1, 'READY'))).toBe(false);
  });
});

describe('serverClockOffset / formatClock', () => {
  it('measures how far the local clock is from the server', () => {
    expect(serverClockOffset('2026-10-02T12:03:00Z', NOW)).toBe(3 * 60_000);
    expect(serverClockOffset(undefined, NOW)).toBe(0);
  });

  it('formats a 24h clock time, or a dash when missing', () => {
    expect(formatClock(null)).toBe('—');
    expect(formatClock('2026-10-02T12:05:00Z', 'en-GB')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('pickDefaultBranchId', () => {
  const b = (id: number, active: number) => ({
    id,
    name: `B${id}`,
    status: 'ACTIVE',
    counts: { NEW: active, PREPARING: 0, READY: 0 },
    active,
  });

  it('picks the branch with the most orders waiting, wherever it is in the list', () => {
    expect(pickDefaultBranchId([b(950099, 0), b(900002, 4), b(900001, 7)])).toBe(900001);
  });

  it('keeps list order on a tie (including all-empty) and returns null for no branch', () => {
    expect(pickDefaultBranchId([b(3, 2), b(1, 2)])).toBe(3);
    expect(pickDefaultBranchId([b(5, 0), b(6, 0)])).toBe(5);
    expect(pickDefaultBranchId([])).toBeNull();
  });
});

describe('laneOf / dropTargetFor (drag and drop)', () => {
  it('puts finished orders in the Done lane and the rest in their own', () => {
    expect(laneOf('NEW')).toBe('NEW');
    expect(laneOf('READY')).toBe('READY');
    expect(laneOf('COMPLETED')).toBe('DONE');
    expect(laneOf('CANCELLED')).toBe('DONE');
  });

  it('lets a card be dropped only into the lane of its next forward step', () => {
    expect(dropTargetFor(order(1, 'NEW'))).toEqual({ lane: 'PREPARING', status: 'PREPARING' });
    expect(dropTargetFor(order(1, 'PREPARING'))).toEqual({ lane: 'READY', status: 'READY' });
    expect(dropTargetFor(order(1, 'READY'))).toEqual({ lane: 'DONE', status: 'COMPLETED' });
  });

  it('never makes a drop mean cancel, and finished cards cannot be dragged', () => {
    expect(dropTargetFor(order(1, 'NEW', { next_statuses: ['CANCELLED'] }))).toBeNull();
    expect(dropTargetFor(order(1, 'COMPLETED'))).toBeNull();
    expect(dropTargetFor(order(1, 'CANCELLED'))).toBeNull();
  });
});
