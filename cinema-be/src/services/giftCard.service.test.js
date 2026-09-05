const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const giftCardService = require('./giftCard.service');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('giftCard.service.issue', () => {
  it('creates a gift card with remaining_balance = initial_balance and writes an ISSUE transaction', async () => {
    const card = await giftCardService.issue({ code: 'welcome100', initialBalance: 100000 });
    expect(card.code).toBe('WELCOME100');
    expect(card.remaining_balance).toBe(100000);
    const tx = await GiftCardTransaction.findOne({ gift_card_id: card.id });
    expect(tx.type).toBe('ISSUE');
    expect(tx.balance_after).toBe(100000);
  });
});

describe('giftCard.service.redeem', () => {
  it('claims an unowned, active gift card into the caller account', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 50000, remaining_balance: 50000 });
    const result = await giftCardService.redeem('gc1', 42);
    expect(result.giftCard.owner_account_id).toBe(42);
    expect(result.giftCard.redeemed_at).toBeInstanceOf(Date);
    const tx = await GiftCardTransaction.findOne({ gift_card_id: 1, type: 'REDEEM' });
    expect(tx.account_id).toBe(42);
  });

  it('returns GIFT_CARD_NOT_FOUND for an unknown code', async () => {
    const result = await giftCardService.redeem('NOPE', 1);
    expect(result.error).toBe('GIFT_CARD_NOT_FOUND');
  });

  it('rejects redeeming a card already owned by someone else', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1, remaining_balance: 1, owner_account_id: 99 });
    const result = await giftCardService.redeem('GC1', 42);
    expect(result.error).toBe('GIFT_CARD_ALREADY_REDEEMED');
  });

  it('rejects redeeming an already-owned-by-you card distinctly', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1, remaining_balance: 1, owner_account_id: 42 });
    const result = await giftCardService.redeem('GC1', 42);
    expect(result.error).toBe('GIFT_CARD_ALREADY_YOURS');
  });

  it('rejects redeeming a blocked card', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1, remaining_balance: 1, status: 'BLOCKED' });
    const result = await giftCardService.redeem('GC1', 42);
    expect(result.error).toBe('GIFT_CARD_BLOCKED');
  });

  it('rejects redeeming an expired card', async () => {
    await GiftCard.create({
      id: 1,
      code: 'GC1',
      initial_balance: 1,
      remaining_balance: 1,
      expires_at: new Date(Date.now() - 86400000),
    });
    const result = await giftCardService.redeem('GC1', 42);
    expect(result.error).toBe('GIFT_CARD_EXPIRED');
  });

  it('never lets two concurrent redeem calls both claim the same card (race-safe)', async () => {
    await GiftCard.create({ id: 1, code: 'RACE1', initial_balance: 10000, remaining_balance: 10000 });

    const [a, b] = await Promise.all([
      giftCardService.redeem('RACE1', 10),
      giftCardService.redeem('RACE1', 20),
    ]);

    const results = [a, b];
    const winners = results.filter((r) => !r.error);
    const losers = results.filter((r) => r.error);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].error).toBe('GIFT_CARD_ALREADY_REDEEMED');

    const card = await GiftCard.findOne({ id: 1 });
    expect(card.owner_account_id).toBe(winners[0].giftCard.owner_account_id);
    // Only one REDEEM transaction was ever written.
    expect(await GiftCardTransaction.countDocuments({ gift_card_id: 1, type: 'REDEEM' })).toBe(1);
  });
});

describe('giftCard.service.previewForOrder', () => {
  it('returns the min(remaining_balance, orderValue) without mutating the balance', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 50000, remaining_balance: 50000, owner_account_id: 42 });
    const result = await giftCardService.previewForOrder('GC1', 42, 30000);
    expect(result.eligible).toBe(true);
    expect(result.applicableAmount).toBe(30000);
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(50000);
  });

  it('caps the applicable amount to the remaining balance', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 10000, remaining_balance: 10000, owner_account_id: 42 });
    const result = await giftCardService.previewForOrder('GC1', 42, 30000);
    expect(result.applicableAmount).toBe(10000);
  });

  it('rejects a card not owned by the caller', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 });
    const result = await giftCardService.previewForOrder('GC1', 42, 1000);
    expect(result).toEqual({ eligible: false, reason: 'GIFT_CARD_NOT_OWNED' });
  });

  it('rejects an exhausted balance', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 0, owner_account_id: 42, status: 'USED' });
    const result = await giftCardService.previewForOrder('GC1', 42, 1000);
    expect(result).toEqual({ eligible: false, reason: 'GIFT_CARD_BALANCE_EXHAUSTED' });
  });
});

describe('giftCard.service.debit', () => {
  it('atomically decrements the balance and records a USE transaction', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 50000, remaining_balance: 50000, owner_account_id: 42 });
    const result = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 20000, bookingId: 7 });
    expect(result.giftCard.remaining_balance).toBe(30000);
    expect(result.transaction.amount).toBe(20000);
    expect(result.transaction.booking_id).toBe(7);
  });

  it('flips status to USED once the balance reaches exactly 0', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 5000, remaining_balance: 5000, owner_account_id: 42 });
    const result = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 5000, bookingId: 1 });
    expect(result.giftCard.status).toBe('USED');
  });

  it('refuses to debit more than the remaining balance', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 });
    const result = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 2000, bookingId: 1 });
    expect(result).toBeNull();
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(1000);
  });

  it('refuses to debit a card owned by someone else', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 });
    const result = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 500, bookingId: 1 });
    expect(result).toBeNull();
  });

  it('is idempotent: a duplicate request for the same bookingId does not double-spend', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 10000, remaining_balance: 10000, owner_account_id: 42 });
    const first = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 4000, bookingId: 55 });
    expect(first.giftCard.remaining_balance).toBe(6000);

    const retry = await giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 4000, bookingId: 55 });
    expect(retry.alreadyProcessed).toBe(true);
    expect(retry.transaction.id).toBe(first.transaction.id);

    // Balance was only ever debited once, no matter how many times the request is retried.
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(6000);
    expect(await GiftCardTransaction.countDocuments({ gift_card_id: 1, booking_id: 55, type: 'USE' })).toBe(1);
  });

  it('never lets concurrent debits push the balance negative (atomic, race-safe)', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 10000, remaining_balance: 10000, owner_account_id: 42 });

    // Two concurrent spends of 6000 each against a 10000 balance — at most one can succeed.
    const [a, b] = await Promise.all([
      giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 6000, bookingId: 1 }),
      giftCardService.debit({ giftCardId: 1, accountId: 42, amount: 6000, bookingId: 2 }),
    ]);

    const succeeded = [a, b].filter(Boolean);
    expect(succeeded).toHaveLength(1);
    const card = await GiftCard.findOne({ id: 1 });
    expect(card.remaining_balance).toBe(4000);
    expect(card.remaining_balance).toBeGreaterThanOrEqual(0);
  });
});

describe('giftCard.service.pay', () => {
  async function seedOrder({ price = 100000 } = {}) {
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      cinema_id: 5,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price,
    });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
  }

  it('fully pays a booking when the balance covers the total, and debits exactly the total', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'PAYFULL', initial_balance: 200000, remaining_balance: 200000, owner_account_id: 42 });

    const result = await giftCardService.pay({ code: 'PAYFULL', ticketIds: [1], comboIds: [], accountId: 42 });

    expect(result.error).toBeUndefined();
    expect(result.totalPrice).toBe(100000);
    const card = await GiftCard.findOne({ id: 1 });
    expect(card.remaining_balance).toBe(100000);

    const booking = await Booking.findOne({ account_id: 42 });
    expect(booking.status).toBe('PAID');
    expect(booking.total_price).toBe(100000);
    const invoice = await Invoice.findOne({ ticket_id: 1 });
    expect(invoice.ticket_status).toBe('ISSUED');
  });

  it('rejects a card that cannot cover the full order total', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'TOOLOW', initial_balance: 5000, remaining_balance: 5000, owner_account_id: 42 });

    const result = await giftCardService.pay({ code: 'TOOLOW', ticketIds: [1], comboIds: [], accountId: 42 });

    expect(result.error).toBe('INSUFFICIENT_BALANCE');
    expect(result.shortfall).toBe(95000);
    // Balance must be untouched on rejection.
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(5000);
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('rejects a card that does not belong to the caller', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'NOTMINE', initial_balance: 200000, remaining_balance: 200000, owner_account_id: 99 });

    const result = await giftCardService.pay({ code: 'NOTMINE', ticketIds: [1], comboIds: [], accountId: 42 });
    expect(result.error).toBe('GIFT_CARD_NOT_OWNED');
  });

  it('is idempotent on the idempotency key: a retried pay never creates a second booking or double-spends', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'IDEMPO', initial_balance: 200000, remaining_balance: 200000, owner_account_id: 42 });

    const first = await giftCardService.pay({
      code: 'IDEMPO',
      ticketIds: [1],
      comboIds: [],
      accountId: 42,
      idempotencyKey: 'same-key-1',
    });
    const second = await giftCardService.pay({
      code: 'IDEMPO',
      ticketIds: [1],
      comboIds: [],
      accountId: 42,
      idempotencyKey: 'same-key-1',
    });

    expect(second.alreadyProcessed).toBe(true);
    expect(second.bookingId).toBe(first.bookingId);
    expect(await Booking.countDocuments()).toBe(1);
    // Debited exactly once for the one real booking.
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(100000);
  });
});

describe('giftCard.service.expireGiftCards', () => {
  it('flips a lapsed ACTIVE card to EXPIRED', async () => {
    await GiftCard.create({
      id: 1,
      code: 'OLD1',
      initial_balance: 1000,
      remaining_balance: 1000,
      expires_at: new Date(Date.now() - 86400000),
    });
    const count = await giftCardService.expireGiftCards();
    expect(count).toBe(1);
    expect((await GiftCard.findOne({ id: 1 })).status).toBe('EXPIRED');
  });

  it('leaves a card with no expiry, or one not yet expired, untouched', async () => {
    await GiftCard.create([
      { id: 1, code: 'NOEXP', initial_balance: 1000, remaining_balance: 1000, expires_at: null },
      { id: 2, code: 'FUTURE', initial_balance: 1000, remaining_balance: 1000, expires_at: new Date(Date.now() + 86400000) },
    ]);
    const count = await giftCardService.expireGiftCards();
    expect(count).toBe(0);
    expect((await GiftCard.findOne({ id: 1 })).status).toBe('ACTIVE');
    expect((await GiftCard.findOne({ id: 2 })).status).toBe('ACTIVE');
  });

  it('does not touch an already-BLOCKED or already-USED card even if its expiry has lapsed', async () => {
    await GiftCard.create([
      { id: 1, code: 'BLOCKED1', initial_balance: 1000, remaining_balance: 1000, status: 'BLOCKED', expires_at: new Date(Date.now() - 1000) },
      { id: 2, code: 'USED1', initial_balance: 1000, remaining_balance: 0, status: 'USED', expires_at: new Date(Date.now() - 1000) },
    ]);
    const count = await giftCardService.expireGiftCards();
    expect(count).toBe(0);
    expect((await GiftCard.findOne({ id: 1 })).status).toBe('BLOCKED');
    expect((await GiftCard.findOne({ id: 2 })).status).toBe('USED');
  });
});
