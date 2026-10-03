import '@/i18n';
import i18n from '@/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { KdsOrder } from '../types/kds.types';
import { KdsOrderCard } from './KdsOrderCard';

const NOW = Date.parse('2026-10-03T12:10:00.000Z');

function order(overrides: Partial<KdsOrder> = {}): KdsOrder {
  return {
    id: 1,
    code: 'CO-1',
    branch_id: 1,
    status: 'NEW',
    items: [{ combo_id: 1, name: 'Large Popcorn', quantity: 2 }],
    item_count: 2,
    created_at: '2026-10-03T12:00:00.000Z',
    status_changed_at: '2026-10-03T12:01:00.000Z',
    timestamps: {
      NEW: '2026-10-03T12:01:00.000Z',
      PREPARING: null,
      READY: null,
      COMPLETED: null,
      CANCELLED: null,
    },
    customer: { id: 10, name: 'Lan Nguyen' },
    booking: {
      id: 100,
      code: 'BK-100',
      seats: ['E7', 'E8'],
      room: 'Hall 3',
      showtime: { date: '2026-10-03', time: '19:30' },
    },
    cancel_reason: null,
    next_statuses: ['PREPARING', 'CANCELLED'],
    ...overrides,
  };
}

const renderCard = (o: KdsOrder) =>
  render(
    <KdsOrderCard
      order={o}
      nowMs={NOW}
      canUpdate
      pending={false}
      onAdvance={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe('KdsOrderCard — in-seat delivery (Ticket 49)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('tells staff exactly which seat to take an in-seat order to, instead of every seat on the booking', () => {
    renderCard(
      order({
        channel: 'IN_SEAT',
        delivery: {
          type: 'SEAT',
          seat: 'E7',
          room: 'Hall 3',
          showtime: { date: '2026-10-03', time: '19:30' },
        },
      }),
    );
    expect(screen.getByTestId('kds-delivery').textContent).toContain('Deliver to seat E7 · Hall 3');
    expect(screen.queryByText('E7, E8')).not.toBeInTheDocument();
  });

  it('a counter / booking order keeps showing the booking seats and has no delivery banner', () => {
    renderCard(order());
    expect(screen.queryByTestId('kds-delivery')).not.toBeInTheDocument();
    expect(screen.getByText('E7, E8')).toBeInTheDocument();
  });
});
