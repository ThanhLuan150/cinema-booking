jest.mock('../utils/socket');

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, PRICE, DAY, seedMembershipWorld, setTier, giveSubscription } = require('../../tests/membershipFixtures');
const membershipService = require('./membership.service');
const MembershipBenefitUsage = require('../models/MembershipBenefitUsage');
const MembershipLevel = require('../models/MembershipLevel');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const TierBenefitCounter = require('../models/TierBenefitCounter');
const { periodKey } = require('../utils/membershipBenefits');

beforeAll(async () => {
  await connect();
  await Promise.all([Subscription.init(), TierBenefitCounter.init(), MembershipBenefitUsage.init()]);
});
beforeEach(async () => seedMembershipWorld({ withRbac: false }));
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const seats = (...prices) => prices.map((price, i) => ({ ticketId: i + 1, price }));

async function priceAndReserve(accountId, { freeTickets, code, ticketRows = seats(PRICE.REGULAR, PRICE.REGULAR) }) {
  const member = await membershipService.priceMembership({ accountId, ticketRows, combos: [], freeTickets });
  return membershipService.reserveFreeTickets({
    bookingCode: code,
    accountId,
    allocations: member.pricing.allocations,
    state: member.state,
  });
}

describe('loadState — every benefit is read from the database', () => {
  it('gives a non-member nothing', async () => {
    const state = await membershipService.loadState(ID.LAN);
    expect(state.effective).toEqual({ ticket_discount_percent: 0, fnb_discount_percent: 0, priority_booking_hours: 0, points_multiplier: 1 });
    expect(state.pools).toEqual([]);
  });

  it("gives a member their tier's benefits, but only while the tier is active", async () => {
    await setTier(ID.LAN, 'GOLD');
    expect((await membershipService.loadState(ID.LAN)).effective).toMatchObject({ ticket_discount_percent: 10, priority_booking_hours: 12 });

    await MembershipLevel.updateOne({ code: 'GOLD' }, { $set: { active: false } });
    expect((await membershipService.loadState(ID.LAN)).effective.ticket_discount_percent).toBe(0);
  });

  it('adds a live subscription, but never one past its term or not yet paid', async () => {
    const subscription = await giveSubscription(ID.LAN);
    let state = await membershipService.loadState(ID.LAN);
    expect(state.subscription.id).toBe(subscription.id);
    expect(state.effective.fnb_discount_percent).toBe(10);
    expect(state.pools).toEqual([expect.objectContaining({ source: 'SUBSCRIPTION', remaining: 4 })]);

    // Still ACTIVE (the sweep has not run) but its end_at has passed: no benefit.
    await Subscription.updateOne({ id: subscription.id }, { $set: { end_at: new Date(Date.now() - 1000) } });
    state = await membershipService.loadState(ID.LAN);
    expect(state.subscription).toBeNull();
    expect(state.effective.fnb_discount_percent).toBe(0);

    await Subscription.updateOne(
      { id: subscription.id },
      { $set: { status: 'PENDING_PAYMENT', end_at: new Date(Date.now() + DAY) } },
    );
    expect((await membershipService.loadState(ID.LAN)).subscription).toBeNull();
  });
});

describe('getMyMembership', () => {
  it('reports the tier, the next tier, the live subscription and the free tickets left', async () => {
    await setTier(ID.LAN, 'PLATINUM');
    await giveSubscription(ID.LAN, { ticketsUsed: 1 });
    const me = await membershipService.getMyMembership(ID.LAN);
    expect(me.level).toMatchObject({ code: 'PLATINUM', benefits: expect.objectContaining({ free_tickets: 1 }) });
    expect(me.next_level).toMatchObject({ code: 'VIP' });
    expect(me.subscription).toMatchObject({ status: 'ACTIVE', tickets_used: 1, tickets_remaining: 3 });
    expect(me.subscription).not.toHaveProperty('open_key');
    expect(me.free_tickets).toMatchObject({
      tier: { limit: 1, used: 0, remaining: 1, period: periodKey() },
      subscription: { limit: 4, used: 1, remaining: 3 },
      remaining_total: 4,
    });
    expect(me.effective_benefits).toMatchObject({ ticket_discount_percent: 10, fnb_discount_percent: 15, priority_booking_hours: 24 });
  });

  it('hands back the MoMo link of an unpaid purchase, so it can be continued', async () => {
    const pending = await giveSubscription(ID.LAN, { status: 'PENDING_PAYMENT' });
    await Subscription.updateOne({ id: pending.id }, { $set: { payment_expires_at: new Date(Date.now() + 60000) } });
    await Payment.create({
      id: 1,
      code: pending.code,
      account_id: ID.LAN,
      type: 'SUBSCRIPTION',
      method: 'MOMO',
      amount: 199000,
      pay_url: 'https://momo.test/pay',
    });
    const me = await membershipService.getMyMembership(ID.LAN);
    expect(me.pending_subscription).toMatchObject({ code: pending.code, pay_url: 'https://momo.test/pay' });

    await Payment.updateOne({ code: pending.code }, { $set: { status: 'FAILED' } });
    expect((await membershipService.getMyMembership(ID.LAN)).pending_subscription.pay_url).toBeNull();
  });
});

describe('reserveFreeTickets — never past the usage limit', () => {
  it('lets only one of two simultaneous checkouts take the last free ticket', async () => {
    const subscription = await giveSubscription(ID.LAN, { ticketsUsed: 3 }); // 1 of 4 left
    const results = await Promise.all([
      priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-A' }),
      priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-B' }),
      priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-C' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => r.code)).toEqual([
      'MEMBERSHIP_FREE_TICKETS_UNAVAILABLE',
      'MEMBERSHIP_FREE_TICKETS_UNAVAILABLE',
    ]);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(4);
    expect(await MembershipBenefitUsage.countDocuments({ status: 'RESERVED' })).toBe(1);
  });

  it('refuses a subscription that ended between the quote and the reservation', async () => {
    const subscription = await giveSubscription(ID.LAN);
    const member = await membershipService.priceMembership({ accountId: ID.LAN, ticketRows: seats(PRICE.REGULAR), combos: [], freeTickets: 1 });
    await Subscription.updateOne({ id: subscription.id }, { $set: { end_at: new Date(Date.now() - 1) } });

    const result = await membershipService.reserveFreeTickets({
      bookingCode: 'BK-1',
      accountId: ID.LAN,
      allocations: member.pricing.allocations,
      state: member.state,
    });
    expect(result.ok).toBe(false);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(0);
  });

  it('gives back what it took from one allowance when another falls short', async () => {
    await setTier(ID.LAN, 'VIP'); // 2 free tickets a month
    const subscription = await giveSubscription(ID.LAN, { ticketsUsed: 3 }); // 1 left
    const member = await membershipService.priceMembership({
      accountId: ID.LAN,
      ticketRows: seats(PRICE.REGULAR, PRICE.REGULAR, PRICE.REGULAR),
      combos: [],
      freeTickets: 3,
    });
    expect(member.pricing.allocations.map((a) => a.source)).toEqual(['SUBSCRIPTION', 'TIER', 'TIER']);
    // The month's allowance is used up elsewhere before this reservation runs.
    await TierBenefitCounter.create({ account_id: ID.LAN, period: periodKey(), used: 1 });

    const result = await membershipService.reserveFreeTickets({
      bookingCode: 'BK-1',
      accountId: ID.LAN,
      allocations: member.pricing.allocations,
      state: member.state,
    });
    expect(result.ok).toBe(false);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(3);
    expect((await TierBenefitCounter.findOne({ account_id: ID.LAN })).used).toBe(1);
    expect(await MembershipBenefitUsage.countDocuments()).toBe(0);
  });

  it("counts a tier's free tickets per calendar month", async () => {
    await setTier(ID.LAN, 'VIP');
    expect((await priceAndReserve(ID.LAN, { freeTickets: 2, code: 'BK-1' })).ok).toBe(true);
    const third = await membershipService.priceMembership({ accountId: ID.LAN, ticketRows: seats(PRICE.REGULAR), combos: [], freeTickets: 1 });
    expect(third.pricing.freeTicketsApplied).toBe(0);
    expect(third.pricing.freeTicketsAvailable).toBe(0);

    // Next month the allowance starts again.
    const nextMonth = new Date(Date.now() + 32 * DAY);
    const later = await membershipService.priceMembership({
      accountId: ID.LAN,
      ticketRows: seats(PRICE.REGULAR),
      combos: [],
      freeTickets: 1,
      now: nextMonth,
    });
    expect(later.pricing.freeTicketsApplied).toBe(1);
  });
});

describe('releaseFreeTickets / consumeFreeTickets', () => {
  it('gives a ticket back exactly once, however often the release runs', async () => {
    const subscription = await giveSubscription(ID.LAN);
    await priceAndReserve(ID.LAN, { freeTickets: 2, code: 'BK-1' });
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(2);

    const released = await Promise.all([
      membershipService.releaseFreeTickets('BK-1', { reason: 'BOOKING_CANCELLED' }),
      membershipService.releaseFreeTickets('BK-1', { reason: 'BOOKING_EXPIRED' }),
    ]);
    expect(released[0] + released[1]).toBe(2);
    expect(await membershipService.releaseFreeTickets('BK-1')).toBe(0);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(0);
  });

  it('releases only the seats asked for', async () => {
    const subscription = await giveSubscription(ID.LAN);
    await priceAndReserve(ID.LAN, { freeTickets: 2, code: 'BK-1' });
    expect(await membershipService.releaseFreeTickets('BK-1', { ticketIds: [1] })).toBe(1);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(1);
    expect((await MembershipBenefitUsage.findOne({ ticket_id: 2 })).status).toBe('RESERVED');
  });

  it('marks the reserved tickets used when the booking is paid', async () => {
    await giveSubscription(ID.LAN);
    await priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-1' });
    expect(await membershipService.consumeFreeTickets('BK-1', { bookingId: 55 })).toEqual({ ok: true, reinstated: 0 });
    expect(await MembershipBenefitUsage.findOne({ booking_code: 'BK-1' })).toMatchObject({ status: 'CONSUMED', booking_id: 55 });
  });

  it('takes a released ticket again for a late payment when the allowance still has it', async () => {
    const subscription = await giveSubscription(ID.LAN);
    await priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-1' });
    await membershipService.releaseFreeTickets('BK-1', { reason: 'BOOKING_EXPIRED' });

    expect(await membershipService.consumeFreeTickets('BK-1', { bookingId: 55 })).toEqual({ ok: true, reinstated: 1 });
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(1);
    expect((await MembershipBenefitUsage.findOne({ booking_code: 'BK-1' })).status).toBe('CONSUMED');
  });

  it('refuses a late payment when the released ticket has gone meanwhile, and keeps the limit', async () => {
    const subscription = await giveSubscription(ID.LAN, { ticketsUsed: 3 });
    await priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-1' });
    await membershipService.releaseFreeTickets('BK-1', { reason: 'BOOKING_EXPIRED' });
    expect((await priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-2' })).ok).toBe(true); // the last one, elsewhere

    expect(await membershipService.consumeFreeTickets('BK-1', { bookingId: 55 })).toMatchObject({ ok: false });
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(4);
    expect((await MembershipBenefitUsage.findOne({ booking_code: 'BK-1' })).status).toBe('RELEASED');
  });

  it('refuses a late payment once the subscription has expired', async () => {
    const subscription = await giveSubscription(ID.LAN);
    await priceAndReserve(ID.LAN, { freeTickets: 1, code: 'BK-1' });
    await membershipService.releaseFreeTickets('BK-1', { reason: 'BOOKING_EXPIRED' });
    await Subscription.updateOne({ id: subscription.id }, { $set: { end_at: new Date(Date.now() - 1) } });

    expect((await membershipService.consumeFreeTickets('BK-1')).ok).toBe(false);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(0);
  });
});

describe('checkSaleAccess (Priority Booking)', () => {
  const schedule = (hoursUntilSale) => ({ id: 7, sale_opens_at: new Date(Date.now() + hoursUntilSale * 60 * 60 * 1000) });

  it('lets anyone book a showtime with no sale date', async () => {
    expect(await membershipService.checkSaleAccess({ schedule: { id: 7, sale_opens_at: null }, accountId: ID.LAN })).toBeNull();
  });

  it("opens early only for a member whose priority window covers it", async () => {
    const blocked = await membershipService.checkSaleAccess({ schedule: schedule(6), accountId: ID.LAN });
    expect(blocked).toMatchObject({ status: 403, body: { code: 'SALE_NOT_OPEN' } });

    await setTier(ID.LAN, 'GOLD'); // 12h early
    expect(await membershipService.checkSaleAccess({ schedule: schedule(6), accountId: ID.LAN })).toBeNull();
    const tooEarly = await membershipService.checkSaleAccess({ schedule: schedule(13), accountId: ID.LAN });
    expect(tooEarly.body.opens_at.getTime()).toBeCloseTo(Date.now() + 1 * 60 * 60 * 1000, -4);
  });
});
