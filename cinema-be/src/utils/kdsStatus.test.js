const {
  KDS_STATUS,
  KDS_STATUSES,
  KDS_TO_ORDER_STATUS,
  KDS_TRANSITIONS,
  toKdsStatus,
  canTransition,
  kdsTimestamps,
  parseKdsStatuses,
  validateStatusUpdate,
} = require('./kdsStatus');

const paidAt = new Date('2026-10-02T08:00:00Z');

describe('kdsStatus.toKdsStatus', () => {
  it('maps every paid order status onto the five KDS statuses', () => {
    expect(toKdsStatus({ status: 'PAID', paid_at: paidAt })).toBe('NEW');
    expect(toKdsStatus({ status: 'PREPARING', paid_at: paidAt })).toBe('PREPARING');
    expect(toKdsStatus({ status: 'READY', paid_at: paidAt })).toBe('READY');
    expect(toKdsStatus({ status: 'DELIVERED', paid_at: paidAt })).toBe('COMPLETED');
    expect(toKdsStatus({ status: 'CANCELLED', paid_at: paidAt })).toBe('CANCELLED');
  });

  it('keeps an unpaid order off the KDS — PENDING, or cancelled before payment', () => {
    expect(toKdsStatus({ status: 'PENDING', paid_at: null })).toBeNull();
    expect(toKdsStatus({ status: 'CANCELLED', paid_at: null })).toBeNull();
    expect(toKdsStatus(null)).toBeNull();
  });

  it('round-trips with KDS_TO_ORDER_STATUS for every KDS status', () => {
    for (const status of KDS_STATUSES) {
      expect(toKdsStatus({ status: KDS_TO_ORDER_STATUS[status], paid_at: paidAt })).toBe(status);
    }
  });
});

describe('kdsStatus transitions', () => {
  it('only moves forward: NEW -> PREPARING -> READY -> COMPLETED, cancel before READY', () => {
    expect(canTransition('NEW', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'COMPLETED')).toBe(true);
    expect(canTransition('NEW', 'CANCELLED')).toBe(true);
    expect(canTransition('PREPARING', 'CANCELLED')).toBe(true);

    expect(canTransition('NEW', 'READY')).toBe(false); // no skipping
    expect(canTransition('NEW', 'COMPLETED')).toBe(false);
    expect(canTransition('READY', 'PREPARING')).toBe(false); // no going back
    expect(canTransition('READY', 'CANCELLED')).toBe(false); // already made
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'NEW')).toBe(false);
  });

  it('never allows a transition back to NEW and leaves terminal statuses terminal', () => {
    for (const targets of Object.values(KDS_TRANSITIONS)) expect(targets).not.toContain('NEW');
    expect(KDS_TRANSITIONS.COMPLETED).toEqual([]);
    expect(KDS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('kdsStatus.kdsTimestamps', () => {
  it('exposes one timestamp per KDS status, null until reached', () => {
    const order = {
      paid_at: paidAt,
      prepared_at: new Date('2026-10-02T08:02:00Z'),
      ready_at: null,
      delivered_at: undefined,
      cancelled_at: null,
    };
    expect(kdsTimestamps(order)).toEqual({
      NEW: paidAt,
      PREPARING: order.prepared_at,
      READY: null,
      COMPLETED: null,
      CANCELLED: null,
    });
  });
});

describe('kdsStatus.parseKdsStatuses', () => {
  it('parses a comma list case-insensitively and de-duplicates', () => {
    expect(parseKdsStatuses('new, Preparing,NEW')).toEqual({ statuses: ['NEW', 'PREPARING'] });
    expect(parseKdsStatuses(['READY', 'completed'])).toEqual({ statuses: ['READY', 'COMPLETED'] });
  });

  it('returns null for "no filter" and an error for unknown statuses', () => {
    expect(parseKdsStatuses(undefined)).toEqual({ statuses: null });
    expect(parseKdsStatuses('')).toEqual({ statuses: null });
    expect(parseKdsStatuses('NEW,PAID,DELIVERED')).toEqual({
      error: { code: 'INVALID_KDS_STATUS', invalid: ['PAID', 'DELIVERED'] },
    });
  });
});

describe('kdsStatus.validateStatusUpdate', () => {
  it('accepts a forward status, upper-casing it', () => {
    expect(validateStatusUpdate({ status: 'preparing' })).toEqual({
      status: 'PREPARING',
      reason: null,
    });
    expect(validateStatusUpdate({ status: 'COMPLETED', reason: 'ignored' })).toEqual({
      status: 'COMPLETED',
      reason: null,
    });
  });

  it('refuses any price field with KDS_PRICE_READONLY', () => {
    for (const body of [
      { status: 'READY', total_price: 1 },
      { status: 'READY', unit_price: 1 },
      { status: 'READY', price: 0 },
      { status: 'READY', items: [{ combo_id: 1, unit_price: 0 }] },
      { status: 'READY', line_total: 0 },
      { status: 'READY', discount_amount: 5 },
    ]) {
      const result = validateStatusUpdate(body);
      expect(result.error).toEqual(expect.objectContaining({ code: 'KDS_PRICE_READONLY' }));
    }
  });

  it('refuses any other unknown field with KDS_FIELD_NOT_ALLOWED', () => {
    expect(validateStatusUpdate({ status: 'READY', branch_id: 2 }).error).toEqual(
      expect.objectContaining({ code: 'KDS_FIELD_NOT_ALLOWED', fields: ['branch_id'] }),
    );
  });

  it('refuses a missing/unknown status and moving back to NEW', () => {
    expect(validateStatusUpdate({}).error.code).toBe('INVALID_KDS_STATUS');
    expect(validateStatusUpdate(null).error.code).toBe('INVALID_KDS_STATUS');
    expect(validateStatusUpdate({ status: 'PAID' }).error.code).toBe('INVALID_KDS_STATUS');
    expect(validateStatusUpdate({ status: KDS_STATUS.NEW }).error.code).toBe('INVALID_KDS_STATUS');
    expect(validateStatusUpdate({ status: 7 }).error.code).toBe('INVALID_KDS_STATUS');
  });

  it('requires a non-blank, bounded reason to cancel', () => {
    expect(validateStatusUpdate({ status: 'CANCELLED' }).error.code).toBe(
      'KDS_CANCEL_REASON_REQUIRED',
    );
    expect(validateStatusUpdate({ status: 'CANCELLED', reason: '   ' }).error.code).toBe(
      'KDS_CANCEL_REASON_REQUIRED',
    );
    expect(validateStatusUpdate({ status: 'CANCELLED', reason: 'x'.repeat(301) }).error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(validateStatusUpdate({ status: 'cancelled', reason: '  Out of nachos ' })).toEqual({
      status: 'CANCELLED',
      reason: 'Out of nachos',
    });
  });
});
