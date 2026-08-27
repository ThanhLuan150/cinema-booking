import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import type { Notification } from '@/types/entities';
import { presentNotification } from './notificationPresenter';

// Stand-in translator that mimics i18next: for a real key it returns the interpolated
// "translation" we hand it via `dict`; otherwise it falls back to `defaultValue`.
function makeT(dict: Record<string, string> = {}) {
  const calls: Array<{ key: string; opts?: Record<string, unknown> }> = [];
  const t = ((key: string, opts?: Record<string, unknown>) => {
    calls.push({ key, opts });
    let s = dict[key] ?? (opts?.defaultValue as string) ?? key;
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        if (k === 'defaultValue') continue;
        s = s.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return s;
  }) as unknown as TFunction;
  return { t, calls };
}

function make(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    account_id: 7,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment successful',
    body: 'Your payment for "Dune" was successful.',
    data: { movie: 'Dune', bookingCode: 'BK-1', amount: 120000 },
    channels: ['IN_APP'],
    status: 'SENT',
    read_at: null,
    sent_at: null,
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('presentNotification', () => {
  it('maps type to an icon + tone', () => {
    const { t } = makeT();
    const v = presentNotification(make(), t);
    expect(v.tone).toBe('positive');
    expect(v.icon).toContain('fa-');
  });

  it('interpolates safe data fields into the localised description', () => {
    const { t } = makeT({
      'notifications.feed.types.PAYMENT_SUCCESS.title': 'Payment successful',
      'notifications.feed.types.PAYMENT_SUCCESS.body': 'Payment for "{{movie}}" ok — booking {{bookingCode}}, {{amount}}',
    });
    const v = presentNotification(make(), t);
    expect(v.description).toBe('Payment for "Dune" ok — booking BK-1, 120,000');
  });

  it('flattens showtime + seats for interpolation', () => {
    const { t } = makeT({
      'notifications.feed.types.TICKET_ISSUED.body': 'seats {{seats}} at {{showtime}}',
    });
    const v = presentNotification(
      make({
        type: 'TICKET_ISSUED',
        data: {
          seats: ['A1', 'A2'],
          showtime: { date: '2026-09-01', time_begin: '19:00', time_end: '21:00' },
        },
      }),
      t,
    );
    expect(v.description).toBe('seats A1, A2 at 2026-09-01 19:00');
  });

  it('falls back to the server-provided body/title when no translation exists', () => {
    const { t } = makeT();
    const v = presentNotification(make({ data: null }), t);
    expect(v.title).toBe('Payment successful');
    expect(v.description).toBe('Your payment for "Dune" was successful.');
  });

  it('gives an unknown type a neutral tone and the default bell icon', () => {
    const { t } = makeT();
    // @ts-expect-error deliberately exercising the fallback branch
    const v = presentNotification(make({ type: 'SOMETHING_ELSE' }), t);
    expect(v.tone).toBe('neutral');
    expect(v.icon).toBe('fa-regular fa-bell');
  });
});
