const {
  normalizeBenefits,
  validateBenefitsInput,
  isSubscriptionLive,
  combineBenefits,
  periodKey,
  buildFreeTicketPools,
  computeMembershipPricing,
  checkSaleWindow,
  parseSaleOpensAt,
} = require('./membershipBenefits');

const HOUR = 60 * 60 * 1000;

describe('normalizeBenefits', () => {
  it('fills every missing field with its default', () => {
    expect(normalizeBenefits(undefined)).toEqual({
      ticket_discount_percent: 0,
      fnb_discount_percent: 0,
      free_tickets: 0,
      free_ticket_max_value: null,
      priority_booking_hours: 0,
      points_multiplier: 1,
    });
    expect(normalizeBenefits({ free_tickets: 4, points_multiplier: null })).toMatchObject({ free_tickets: 4, points_multiplier: 1 });
  });

  it('keeps a null cap (= the whole seat price)', () => {
    expect(normalizeBenefits({ free_ticket_max_value: null }).free_ticket_max_value).toBeNull();
    expect(normalizeBenefits({ free_ticket_max_value: 80000 }).free_ticket_max_value).toBe(80000);
  });
});

describe('validateBenefitsInput', () => {
  it('accepts a partial block and returns only what was sent', () => {
    expect(validateBenefitsInput({ fnb_discount_percent: 10, free_tickets: '4' })).toEqual({
      benefits: { fnb_discount_percent: 10, free_tickets: 4 },
    });
    expect(validateBenefitsInput(undefined)).toEqual({ benefits: {} });
  });

  it.each([
    [{ ticket_discount_percent: 101 }, 'ticket_discount_percent'],
    [{ fnb_discount_percent: -1 }, 'fnb_discount_percent'],
    [{ free_tickets: 1.5 }, 'free_tickets'],
    [{ points_multiplier: 0.5 }, 'points_multiplier'],
    [{ priority_booking_hours: 'soon' }, 'priority_booking_hours'],
    [{ free_ticket: 4 }, 'free_ticket'],
  ])('refuses %j', (input, field) => {
    const result = validateBenefitsInput(input);
    expect(result.errors).toEqual([expect.objectContaining({ field })]);
  });

  it('refuses something that is not an object', () => {
    expect(validateBenefitsInput([1]).errors[0].field).toBe('benefits');
    expect(validateBenefitsInput(null).errors[0].field).toBe('benefits');
  });
});

describe('isSubscriptionLive', () => {
  const now = new Date('2026-10-24T10:00:00Z');
  const live = { status: 'ACTIVE', start_at: new Date(now.getTime() - HOUR), end_at: new Date(now.getTime() + HOUR) };

  it('is live only while ACTIVE and inside its term', () => {
    expect(isSubscriptionLive(live, now)).toBe(true);
    expect(isSubscriptionLive({ ...live, status: 'PENDING_PAYMENT' }, now)).toBe(false);
    expect(isSubscriptionLive({ ...live, status: 'CANCELLED' }, now)).toBe(false);
    expect(isSubscriptionLive({ ...live, start_at: null, end_at: null }, now)).toBe(false);
    expect(isSubscriptionLive(null, now)).toBe(false);
  });

  it('is not live once end_at has passed, even if the sweep has not marked it EXPIRED yet', () => {
    expect(isSubscriptionLive({ ...live, end_at: now }, now)).toBe(false);
    expect(isSubscriptionLive({ ...live, end_at: new Date(now.getTime() - 1) }, now)).toBe(false);
  });
});

describe('combineBenefits', () => {
  it('takes the better of tier and subscription for every percentage, the priority and the multiplier', () => {
    const tier = { ticket_discount_percent: 10, fnb_discount_percent: 5, priority_booking_hours: 12, points_multiplier: 1.25 };
    const plan = { ticket_discount_percent: 0, fnb_discount_percent: 10, priority_booking_hours: 0, points_multiplier: 2 };
    expect(combineBenefits(tier, plan)).toEqual({
      ticket_discount_percent: 10,
      fnb_discount_percent: 10,
      priority_booking_hours: 12,
      points_multiplier: 2,
    });
  });

  it('is the tier alone without a subscription, and nothing without either', () => {
    expect(combineBenefits({ fnb_discount_percent: 5 }, null).fnb_discount_percent).toBe(5);
    expect(combineBenefits(null, null)).toEqual({
      ticket_discount_percent: 0,
      fnb_discount_percent: 0,
      priority_booking_hours: 0,
      points_multiplier: 1,
    });
  });
});

describe('periodKey', () => {
  it('turns the month over at midnight in the business timezone, not in UTC or the host zone', () => {
    // 2026-10-31T17:30Z is already 00:30 on 1 November in Ho Chi Minh City (UTC+7).
    expect(periodKey(new Date('2026-10-31T16:59:00Z'))).toBe('2026-10');
    expect(periodKey(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11');
    expect(periodKey(new Date('2026-10-31T17:30:00Z'), 'UTC')).toBe('2026-10');
  });
});

describe('buildFreeTicketPools', () => {
  it('spends the subscription before the tier, and reports what is left of each', () => {
    const pools = buildFreeTicketPools({
      subscription: { id: 7, tickets_used: 3 },
      subscriptionBenefits: { free_tickets: 4, free_ticket_max_value: 90000 },
      tierBenefits: { free_tickets: 2 },
      tierUsed: 2,
      period: '2026-10',
    });
    expect(pools).toEqual([
      { source: 'SUBSCRIPTION', subscription_id: 7, limit: 4, used: 3, remaining: 1, max_value: 90000 },
      { source: 'TIER', period: '2026-10', limit: 2, used: 2, remaining: 0, max_value: null },
    ]);
  });

  it('has no tier pool when the tier gives no free tickets', () => {
    expect(buildFreeTicketPools({ tierBenefits: { free_tickets: 0 } })).toEqual([]);
  });
});

describe('computeMembershipPricing', () => {
  const seats = [
    { ticketId: 1, price: 100000 },
    { ticketId: 2, price: 120000 },
    { ticketId: 3, price: 100000 },
  ];
  const combos = [
    { id: 1, price: 50000 },
    { id: 1, price: 50000 },
    { id: 2, price: 30000 },
  ];
  const pool = (overrides = {}) => ({ source: 'SUBSCRIPTION', subscription_id: 1, remaining: 4, max_value: null, ...overrides });

  it('covers the dearest seats first, only as many as asked for', () => {
    const result = computeMembershipPricing({ ticketRows: seats, combos: [], effective: {}, pools: [pool()], freeTickets: 2 });
    expect(result.allocations.map((a) => a.ticketId)).toEqual([2, 1]);
    expect(result.freeTicketAmount).toBe(220000);
    expect(result.freeTicketsApplied).toBe(2);
    expect(result.adjustedTicketRows).toEqual([
      { ticketId: 1, price: 0 },
      { ticketId: 2, price: 0 },
      { ticketId: 3, price: 100000 },
    ]);
  });

  it('never covers more than a pool has left, and moves on to the next pool', () => {
    const result = computeMembershipPricing({
      ticketRows: seats,
      combos: [],
      effective: {},
      pools: [pool({ remaining: 1 }), { source: 'TIER', period: '2026-10', remaining: 1, max_value: null }],
      freeTickets: 3,
    });
    expect(result.allocations.map((a) => [a.ticketId, a.source])).toEqual([
      [2, 'SUBSCRIPTION'],
      [1, 'TIER'],
    ]);
    expect(result.freeTicketsApplied).toBe(2);
    expect(result.freeTicketsAvailable).toBe(2);
  });

  it('covers at most the pool cap of a seat', () => {
    const result = computeMembershipPricing({ ticketRows: seats, combos: [], effective: {}, pools: [pool({ max_value: 90000 })], freeTickets: 1 });
    expect(result.allocations).toEqual([expect.objectContaining({ ticketId: 2, amount: 90000 })]);
    expect(result.adjustedTicketRows.find((r) => r.ticketId === 2).price).toBe(30000);
  });

  it('takes the ticket percentage off what is left of each seat, and the F&B percentage off each item', () => {
    const result = computeMembershipPricing({
      ticketRows: seats,
      combos,
      effective: { ticket_discount_percent: 10, fnb_discount_percent: 10 },
      pools: [pool({ max_value: 90000 })],
      freeTickets: 1,
    });
    // seat 2: 120000 - 90000 covered = 30000, -10% = 3000; seats 1 & 3: 10000 each
    expect(result.ticketDiscount).toBe(23000);
    expect(result.fnbDiscount).toBe(13000);
    expect(result.membershipDiscount).toBe(90000 + 23000 + 13000);
    expect(result.adjustedCombos).toEqual([
      { id: 1, price: 45000 },
      { id: 1, price: 45000 },
      { id: 2, price: 27000 },
    ]);
  });

  it('gives nothing without benefits or pools, so a non-member pays exactly the list price', () => {
    const result = computeMembershipPricing({ ticketRows: seats, combos, effective: {}, pools: [], freeTickets: 2 });
    expect(result.membershipDiscount).toBe(0);
    expect(result.freeTicketsApplied).toBe(0);
    expect(result.adjustedTicketRows).toEqual(seats);
    expect(result.adjustedCombos).toEqual(combos);
  });

  it('does not spend a free ticket on a seat that already costs nothing', () => {
    const result = computeMembershipPricing({
      ticketRows: [{ ticketId: 1, price: 0 }, { ticketId: 2, price: 80000 }],
      combos: [],
      effective: {},
      pools: [pool()],
      freeTickets: 2,
    });
    expect(result.allocations.map((a) => a.ticketId)).toEqual([2]);
    expect(result.freeTicketsAvailable).toBe(1);
  });
});

describe('checkSaleWindow (Priority Booking)', () => {
  const opens = new Date('2026-11-01T03:00:00Z');

  it('is open to everyone with no sale_opens_at, or once it has passed', () => {
    expect(checkSaleWindow({ saleOpensAt: null }).open).toBe(true);
    expect(checkSaleWindow({ saleOpensAt: opens, now: opens }).open).toBe(true);
  });

  it('lets a member in priority_booking_hours early, and nobody earlier', () => {
    const tenHoursBefore = new Date(opens.getTime() - 10 * HOUR);
    expect(checkSaleWindow({ saleOpensAt: opens, priorityHours: 12, now: tenHoursBefore })).toMatchObject({ open: true, priority: true });

    const result = checkSaleWindow({ saleOpensAt: opens, priorityHours: 12, now: new Date(opens.getTime() - 13 * HOUR) });
    expect(result.open).toBe(false);
    expect(result.opensAt).toEqual(new Date(opens.getTime() - 12 * HOUR));
    expect(result.generalOpensAt).toEqual(opens);
  });

  it('keeps a non-member out until general sale', () => {
    const result = checkSaleWindow({ saleOpensAt: opens, priorityHours: 0, now: new Date(opens.getTime() - 1) });
    expect(result).toMatchObject({ open: false, opensAt: opens });
  });
});

describe('parseSaleOpensAt', () => {
  it('needs an explicit offset', () => {
    expect(parseSaleOpensAt('2026-11-01T10:00:00+07:00').value).toEqual(new Date('2026-11-01T03:00:00Z'));
    expect(parseSaleOpensAt('2026-11-01T03:00:00Z').value).toEqual(new Date('2026-11-01T03:00:00Z'));
    expect(parseSaleOpensAt('2026-11-01T10:00:00').error).toBeDefined();
    expect(parseSaleOpensAt('soon').error).toBeDefined();
  });

  it('clears with null or "", and is skipped when not sent', () => {
    expect(parseSaleOpensAt(null)).toEqual({ value: null });
    expect(parseSaleOpensAt('')).toEqual({ value: null });
    expect(parseSaleOpensAt(undefined)).toEqual({ skip: true });
  });
});
