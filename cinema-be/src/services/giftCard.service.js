const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const Payment = require('../models/Payment');
const giftCardRepository = require('../repositories/giftCard.repository');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const nextId = require('../utils/nextId');

function isUsable(giftCard) {
  if (!giftCard) return false;
  if (giftCard.status !== GiftCard.STATUS.ACTIVE) return false;
  if (giftCard.expires_at && giftCard.expires_at <= new Date()) return false;
  return giftCard.remaining_balance > 0;
}

// Every eligibility check above already re-verifies expires_at directly, so a lapsed card can
// never be redeemed/spent even before this sweep runs — this exists purely so `status` itself
// (surfaced to owners/customers) reflects reality, same convention as
// bookingRepository.expireStalePendingBookings / loyaltyService.expirePoints.
async function expireGiftCards() {
  const stale = await GiftCard.find({ status: GiftCard.STATUS.ACTIVE, expires_at: { $ne: null, $lt: new Date() } });
  for (const giftCard of stale) {
    giftCard.status = GiftCard.STATUS.EXPIRED;
    await giftCard.save();
  }
  return stale.length;
}

async function recordTransaction({ giftCardId, accountId = null, type, amount = 0, balanceAfter, bookingId = null, reason = null }) {
  return GiftCardTransaction.create({
    id: await nextId('giftCardTransaction'),
    gift_card_id: giftCardId,
    account_id: accountId !== null && accountId !== undefined ? Number(accountId) : null,
    type,
    amount,
    balance_after: balanceAfter,
    booking_id: bookingId !== null && bookingId !== undefined ? Number(bookingId) : null,
    reason,
  });
}

// Admin/branch-admin issues a new gift card batch of one. Not yet owned by any customer.
async function issue({ code, cinemaId = null, initialBalance, currency = 'VND', expiresAt = null, issuedBy = null }) {
  const id = await nextId('giftCard');
  const giftCard = await giftCardRepository.create({
    id,
    code: String(code).toUpperCase(),
    cinema_id: cinemaId,
    initial_balance: Number(initialBalance),
    remaining_balance: Number(initialBalance),
    currency,
    expires_at: expiresAt,
    issued_by: issuedBy,
    status: GiftCard.STATUS.ACTIVE,
  });
  await recordTransaction({
    giftCardId: giftCard.id,
    type: GiftCardTransaction.TYPE.ISSUE,
    amount: giftCard.initial_balance,
    balanceAfter: giftCard.remaining_balance,
  });
  return giftCard;
}

// Atomically claims an unowned, active, unexpired gift card into the caller's account. The
// `owner_account_id: null` condition in the filter is what makes two concurrent redeem calls
// for the same code race-safe: only one findOneAndUpdate can match and flip ownership.
async function redeem(code, accountId) {
  const normalizedCode = String(code).toUpperCase();
  const giftCard = await GiftCard.findOneAndUpdate(
    {
      code: normalizedCode,
      owner_account_id: null,
      status: GiftCard.STATUS.ACTIVE,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
    },
    { $set: { owner_account_id: Number(accountId), redeemed_at: new Date() } },
    { new: true },
  );

  if (!giftCard) {
    const existing = await giftCardRepository.findByCode(normalizedCode);
    if (!existing) return { error: 'GIFT_CARD_NOT_FOUND' };
    if (existing.owner_account_id !== null) {
      return existing.owner_account_id === Number(accountId)
        ? { error: 'GIFT_CARD_ALREADY_YOURS' }
        : { error: 'GIFT_CARD_ALREADY_REDEEMED' };
    }
    if (existing.status === GiftCard.STATUS.BLOCKED) return { error: 'GIFT_CARD_BLOCKED' };
    if (existing.expires_at && existing.expires_at <= new Date()) return { error: 'GIFT_CARD_EXPIRED' };
    return { error: 'GIFT_CARD_NOT_ELIGIBLE' };
  }

  await recordTransaction({
    giftCardId: giftCard.id,
    accountId,
    type: GiftCardTransaction.TYPE.REDEEM,
    amount: 0,
    balanceAfter: giftCard.remaining_balance,
  });

  return { giftCard };
}

// Preview only — never mutates the balance. Returns the amount that WOULD be applied to an
// order of `orderValue`, without trusting any FE-supplied discount number.
async function previewForOrder(code, accountId, orderValue) {
  const giftCard = await giftCardRepository.findByCode(code);
  if (!giftCard) return { eligible: false, reason: 'GIFT_CARD_NOT_FOUND' };
  if (giftCard.owner_account_id !== Number(accountId)) return { eligible: false, reason: 'GIFT_CARD_NOT_OWNED' };
  if (giftCard.status === GiftCard.STATUS.BLOCKED) return { eligible: false, reason: 'GIFT_CARD_BLOCKED' };
  if (giftCard.expires_at && giftCard.expires_at <= new Date()) return { eligible: false, reason: 'GIFT_CARD_EXPIRED' };
  if (!isUsable(giftCard)) return { eligible: false, reason: 'GIFT_CARD_BALANCE_EXHAUSTED' };

  const applicableAmount = Math.min(giftCard.remaining_balance, Number(orderValue || 0));
  return { eligible: true, giftCard, applicableAmount };
}

// Debits `amount` off the balance atomically and idempotently against `bookingId`: a
// findOneAndUpdate whose filter re-checks ownership/status/sufficient-balance in the same
// operation MongoDB executes atomically, so concurrent spends of the same card can never both
// succeed once the balance would go negative — "Transaction phải atomic khi sử dụng Gift Card".
// Returns { alreadyProcessed: true } on a retried request for a bookingId already debited
// (duplicate-request safety), or null when the card cannot cover `amount` right now.
async function debit({ giftCardId, accountId, amount, bookingId = null, reason = null }) {
  if (bookingId !== null && bookingId !== undefined) {
    const existing = await GiftCardTransaction.findOne({
      gift_card_id: Number(giftCardId),
      booking_id: Number(bookingId),
      type: GiftCardTransaction.TYPE.USE,
    });
    if (existing) {
      return { giftCard: await giftCardRepository.findById(giftCardId), transaction: existing, alreadyProcessed: true };
    }
  }

  if (!(Number(amount) > 0)) return null;

  const giftCard = await GiftCard.findOneAndUpdate(
    {
      id: Number(giftCardId),
      owner_account_id: Number(accountId),
      status: GiftCard.STATUS.ACTIVE,
      remaining_balance: { $gte: Number(amount) },
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
    },
    { $inc: { remaining_balance: -Number(amount) } },
    { new: true },
  );
  if (!giftCard) return null;

  if (giftCard.remaining_balance === 0) {
    await GiftCard.updateOne({ id: giftCard.id }, { $set: { status: GiftCard.STATUS.USED } });
    giftCard.status = GiftCard.STATUS.USED;
  }

  try {
    const transaction = await recordTransaction({
      giftCardId: giftCard.id,
      accountId,
      type: GiftCardTransaction.TYPE.USE,
      amount: Number(amount),
      balanceAfter: giftCard.remaining_balance,
      bookingId,
      reason,
    });
    return { giftCard, transaction };
  } catch (err) {
    // A duplicate slipped past the pre-check above under true concurrency (two identical
    // retries racing). Refund what we just took and surface the transaction that won instead
    // of silently double-charging the card.
    if (err && err.code === 11000) {
      await GiftCard.findOneAndUpdate(
        { id: giftCard.id },
        { $inc: { remaining_balance: Number(amount) }, $set: { status: GiftCard.STATUS.ACTIVE } },
      );
      const existing = await GiftCardTransaction.findOne({
        gift_card_id: giftCard.id,
        booking_id: Number(bookingId),
        type: GiftCardTransaction.TYPE.USE,
      });
      return { giftCard: await giftCardRepository.findById(giftCard.id), transaction: existing, alreadyProcessed: true };
    }
    throw err;
  }
}

// Full "pay with gift card" flow for the customer checkout: prices the real ticket/combo ids
// (never an FE-supplied total), requires the card to fully cover the order, then reuses
// bookingRepository.finalizeMomoOrder (the same code path Box Office/Kiosk checkouts use) so
// ticket issuance, invoices, loyalty points and notifications all happen exactly once, under
// the same idempotency guarantees as every other checkout.
async function pay({ code, ticketIds, comboIds = [], accountId, idempotencyKey = null }) {
  if (idempotencyKey) {
    const existingPayment = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existingPayment) {
      return {
        alreadyProcessed: true,
        bookingId: existingPayment.booking_id,
        code: existingPayment.code,
        totalPrice: existingPayment.amount,
      };
    }
  }

  const priced = await bookingRepository.priceOrderItems({ ticketIds, comboIds, accountId });
  if (!priced) return { error: 'PRICING_FAILED' };

  const totalPrice = priced.orderValue;
  const giftCard = await giftCardRepository.findByCode(code);
  if (!giftCard) return { error: 'GIFT_CARD_NOT_FOUND' };
  if (giftCard.owner_account_id !== Number(accountId)) return { error: 'GIFT_CARD_NOT_OWNED' };
  if (totalPrice > 0 && giftCard.remaining_balance < totalPrice) {
    return { error: 'INSUFFICIENT_BALANCE', shortfall: totalPrice - giftCard.remaining_balance, totalPrice };
  }

  const orderId = `GC-${await nextId('giftCardOrder')}`;

  const debited = totalPrice > 0
    ? await debit({ giftCardId: giftCard.id, accountId, amount: totalPrice, bookingId: null, reason: orderId })
    : { giftCard };
  if (!debited) return { error: 'INSUFFICIENT_BALANCE', totalPrice };

  const result = await bookingRepository.finalizeMomoOrder(orderId, {
    ticketIds,
    comboIds,
    voucherCode: null,
    promotionCode: null,
    discountAmount: 0,
    totalPrice,
    accountId,
    createdBy: accountId,
    seatTotal: priced.seatTotal,
    comboTotal: priced.comboTotal,
  });

  if (result.skipped || result.alreadyProcessed) {
    // Order was already finalized by a concurrent identical request — refund the balance we
    // just (redundantly) debited so the customer is never charged twice for one booking.
    if (totalPrice > 0) {
      await GiftCard.findOneAndUpdate(
        { id: giftCard.id },
        { $inc: { remaining_balance: totalPrice }, $set: { status: GiftCard.STATUS.ACTIVE } },
      );
    }
    return { ...result, code: orderId };
  }

  // Re-tag the USE transaction with the real bookingId now that it exists, so future duplicate
  // requests for this booking are recognized by debit()'s idempotency check.
  if (totalPrice > 0 && debited.transaction) {
    await GiftCardTransaction.updateOne({ id: debited.transaction.id }, { $set: { booking_id: result.bookingId } });
  }

  await paymentRepository.createPayment({
    code: orderId,
    bookingId: result.bookingId,
    accountId,
    branchId: priced.cinemaId,
    type: Payment.TYPE.ONLINE,
    method: Payment.METHOD.GIFT_CARD,
    amount: totalPrice,
    status: Payment.STATUS.PAID,
    idempotencyKey,
    createdBy: accountId,
  });

  return { ...result, code: orderId, totalPrice, giftCardId: giftCard.id };
}

// Admin/branch-admin blocks a card (fraud, error, etc.) — no balance change, just a status flip.
async function block(id) {
  const giftCard = await giftCardRepository.updateFields(id, { status: GiftCard.STATUS.BLOCKED });
  if (!giftCard) return null;
  await recordTransaction({
    giftCardId: giftCard.id,
    type: GiftCardTransaction.TYPE.BLOCK,
    amount: 0,
    balanceAfter: giftCard.remaining_balance,
  });
  return giftCard;
}

module.exports = {
  isUsable,
  issue,
  redeem,
  previewForOrder,
  debit,
  pay,
  block,
  expireGiftCards,
};
