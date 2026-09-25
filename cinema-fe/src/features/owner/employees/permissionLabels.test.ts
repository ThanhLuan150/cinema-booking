import { describe, expect, it } from 'vitest';
import { groupGrants } from './permissionLabels';

describe('groupGrants', () => {
  it('groups codes by module and keeps the order it was given', () => {
    expect(
      groupGrants([
        { code: 'ticket.checkin', scope: 'BRANCH' },
        { code: 'ticket.read', scope: 'BRANCH' },
        { code: 'room.read', scope: 'BRANCH' },
      ]),
    ).toEqual([
      { module: 'ticket', actions: ['checkin', 'read'] },
      { module: 'room', actions: ['read'] },
    ]);
  });

  it('flattens multi-part actions so they can be used as i18n keys', () => {
    expect(
      groupGrants([
        { code: 'combo.order.update', scope: 'BRANCH' },
        { code: 'combo.order.view', scope: 'BRANCH' },
        { code: 'combo.sell', scope: 'BRANCH' },
      ]),
    ).toEqual([{ module: 'combo', actions: ['order_update', 'order_view', 'sell'] }]);
  });

  it('treats view and read as the same action so a module never shows it twice', () => {
    expect(
      groupGrants([
        { code: 'combo.view', scope: 'BRANCH' },
        { code: 'combo.read', scope: 'BRANCH' },
      ]),
    ).toEqual([{ module: 'combo', actions: ['read'] }]);
  });

  it('returns nothing for no grants', () => {
    expect(groupGrants([])).toEqual([]);
  });
});
