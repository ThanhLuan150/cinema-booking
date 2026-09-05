const giftCardRepository = require('../repositories/giftCard.repository');
const giftCardService = require('../services/giftCard.service');
const bookingRepository = require('../repositories/booking.repository');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const REDEEM_ERROR_MESSAGES = {
  GIFT_CARD_NOT_FOUND: 'Gift card code does not exist',
  GIFT_CARD_ALREADY_REDEEMED: 'This gift card has already been redeemed by another account',
  GIFT_CARD_ALREADY_YOURS: 'You have already redeemed this gift card',
  GIFT_CARD_BLOCKED: 'This gift card has been blocked',
  GIFT_CARD_EXPIRED: 'This gift card has expired',
  GIFT_CARD_NOT_ELIGIBLE: 'This gift card cannot be redeemed',
};

const PAY_ERROR_MESSAGES = {
  PRICING_FAILED: 'Unable to price this order',
  GIFT_CARD_NOT_FOUND: 'Gift card code does not exist',
  GIFT_CARD_NOT_OWNED: 'This gift card does not belong to your account',
  INSUFFICIENT_BALANCE: 'This gift card does not have enough balance to cover the order',
};

// A BRANCH-scope caller may only touch gift cards issued for a cinema they own; ALL scope always passes.
async function assertCinemaOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchId) return false;
  const cinema = await giftCardRepository.findCinemaById(branchId);
  return Boolean(cinema && cinema.owner_id === req.account.accountId);
}

// GET /api/gift-cards?branchId= -> management view (owner sees only their own cinemas' cards,
// admin sees all). A CUSTOMER also holds giftCard.read, but only at OWN scope — filtered to
// their own cards, same as the dedicated /mine route below, so this endpoint can never leak
// another customer's cards to them.
async function list(req, res) {
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const ownedIds = await giftCardRepository.findOwnedCinemaIds(req.account.accountId);
    filter.cinema_id = req.query.branchId
      ? ownedIds.includes(Number(req.query.branchId))
        ? Number(req.query.branchId)
        : -1
      : { $in: ownedIds };
  } else if (req.permissionScope === 'OWN') {
    filter.owner_account_id = req.account.accountId;
  } else if (req.query.branchId) {
    filter.cinema_id = Number(req.query.branchId);
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await giftCardRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/gift-cards/mine -> the caller's own redeemed gift cards
async function mine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await giftCardRepository.findMine(req.account.accountId, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/gift-cards/:id/history -> full usage history (owner of the card, or scoped admin/owner)
async function history(req, res) {
  const giftCard = await giftCardRepository.findById(req.params.id);
  if (!giftCard) return res.status(404).json({ message: 'Gift card not found' });

  const isOwnerOfCard = giftCard.owner_account_id === req.account.accountId;
  if (!isOwnerOfCard && !(await assertCinemaOwnership(req, giftCard.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await giftCardRepository.findHistory(giftCard.id, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/gift-cards { code, cinema_id, initial_balance, currency, expires_at }
// (giftCard.create permission; cinema_id null = admin-only, system-wide batch)
async function issue(req, res) {
  const { code, cinema_id, initial_balance, currency, expires_at } = req.body;
  if (!code || initial_balance === undefined) {
    return res.status(400).json({ message: 'code and initial_balance are required' });
  }
  if (!(Number(initial_balance) > 0)) {
    return res.status(400).json({ message: 'initial_balance must be greater than 0' });
  }

  const normalizedCinemaId = cinema_id === undefined || cinema_id === null ? null : Number(cinema_id);
  if (normalizedCinemaId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only admin can issue system-wide gift cards' });
  }
  if (normalizedCinemaId !== null && !(await assertCinemaOwnership(req, normalizedCinemaId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let giftCard;
  try {
    giftCard = await giftCardService.issue({
      code,
      cinemaId: normalizedCinemaId,
      initialBalance: initial_balance,
      currency: currency || 'VND',
      expiresAt: expires_at ? new Date(expires_at) : null,
      issuedBy: req.account.accountId,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'Gift card code already exists', code: 'GIFT_CARD_CODE_EXISTS' });
    }
    throw err;
  }

  await recordAudit({
    req,
    action: ACTION.GIFT_CARD_ISSUED,
    entityType: ENTITY_TYPE.GIFT_CARD,
    entityId: giftCard.id,
    branchId: normalizedCinemaId,
    metadata: { code: giftCard.code, initial_balance: giftCard.initial_balance },
  });

  res.status(201).json(giftCard);
}

// POST /api/gift-cards/redeem { code } -> (auth) claims an unowned gift card into the caller's account
async function redeem(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const result = await giftCardService.redeem(code, req.account.accountId);
  if (result.error) {
    return res.status(400).json({ message: REDEEM_ERROR_MESSAGES[result.error] || 'Unable to redeem this gift card', code: result.error });
  }

  await recordAudit({
    req,
    action: ACTION.GIFT_CARD_REDEEMED,
    entityType: ENTITY_TYPE.GIFT_CARD,
    entityId: result.giftCard.id,
    branchId: result.giftCard.cinema_id,
    metadata: { code: result.giftCard.code },
  });

  res.json(result.giftCard);
}

// POST /api/gift-cards/validate { code, order_value } -> (auth) preview only, never mutates the balance
async function validate(req, res) {
  const { code, order_value } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const result = await giftCardService.previewForOrder(code, req.account.accountId, order_value);
  if (!result.eligible) {
    return res.status(400).json({ message: REDEEM_ERROR_MESSAGES[result.reason] || 'This gift card cannot be applied', code: result.reason });
  }

  res.json({
    code: result.giftCard.code,
    remaining_balance: result.giftCard.remaining_balance,
    currency: result.giftCard.currency,
    applicable_amount: result.applicableAmount,
  });
}

// POST /api/gift-cards/pay { code, ticketIds, comboIds } -> (auth) spends the card's balance to
// fully pay for a held order — the primary "use Gift Card to pay" customer flow.
async function pay(req, res) {
  const { code, ticketIds, comboIds } = req.body;
  if (!code || !Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'code and ticketIds are required' });
  }

  const accountId = req.account.accountId;

  // Every seat must currently be HELD by this account, exactly like the MoMo checkout guard.
  const tickets = await bookingRepository.findTicketsByIds(ticketIds);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const unavailable = ticketIds.filter((id) => {
    const ticket = ticketById.get(Number(id));
    return !ticket || !(ticket.status === 1 || (ticket.status === 2 && ticket.held_by === accountId));
  });
  if (unavailable.length > 0) {
    return res.status(409).json({
      message: 'One or more selected seats are no longer available',
      code: 'SEAT_UNAVAILABLE',
      ticketIds: unavailable,
    });
  }

  const idempotencyKey = req.headers?.['idempotency-key'] || null;
  const result = await giftCardService.pay({
    code,
    ticketIds,
    comboIds: comboIds || [],
    accountId,
    idempotencyKey,
  });

  if (result.error) {
    const status = result.error === 'GIFT_CARD_NOT_FOUND' ? 404 : result.error === 'INSUFFICIENT_BALANCE' ? 409 : 400;
    return res.status(status).json({
      message: PAY_ERROR_MESSAGES[result.error] || 'Unable to pay with this gift card',
      code: result.error,
      ...(result.shortfall !== undefined ? { shortfall: result.shortfall } : {}),
    });
  }

  if (result.bookingId && !result.alreadyProcessed) {
    await recordAudit({
      req,
      action: ACTION.CREATE_BOOKING,
      entityType: ENTITY_TYPE.BOOKING,
      entityId: result.bookingId,
      metadata: { channel: 'GIFT_CARD', seats: ticketIds.length, totalPrice: result.totalPrice },
    });
    await recordAudit({
      req,
      action: ACTION.GIFT_CARD_USED,
      entityType: ENTITY_TYPE.GIFT_CARD,
      entityId: result.giftCardId,
      metadata: { bookingId: result.bookingId, amount: result.totalPrice },
    });
  }

  res.status(201).json({
    bookingId: result.bookingId,
    code: result.code,
    totalPrice: result.totalPrice,
    alreadyProcessed: Boolean(result.alreadyProcessed),
  });
}

// PUT /api/gift-cards/:id { expires_at, currency } (giftCard.update permission, scoped)
async function update(req, res) {
  const giftCard = await giftCardRepository.findById(req.params.id);
  if (!giftCard) return res.status(404).json({ message: 'Gift card not found' });
  if (!(await assertCinemaOwnership(req, giftCard.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updates = {};
  if (req.body.expires_at !== undefined) updates.expires_at = req.body.expires_at ? new Date(req.body.expires_at) : null;
  if (req.body.currency !== undefined) updates.currency = req.body.currency;

  const updated = await giftCardRepository.updateFields(giftCard.id, updates);

  await recordAudit({
    req,
    action: ACTION.GIFT_CARD_UPDATED,
    entityType: ENTITY_TYPE.GIFT_CARD,
    entityId: giftCard.id,
    branchId: giftCard.cinema_id,
    metadata: { code: giftCard.code, updates: Object.keys(updates) },
  });

  res.json(updated);
}

// POST /api/gift-cards/:id/block (giftCard.update permission, scoped) -> admin/branch-admin blocks a card
async function block(req, res) {
  const giftCard = await giftCardRepository.findById(req.params.id);
  if (!giftCard) return res.status(404).json({ message: 'Gift card not found' });
  if (!(await assertCinemaOwnership(req, giftCard.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updated = await giftCardService.block(giftCard.id);

  await recordAudit({
    req,
    action: ACTION.GIFT_CARD_BLOCKED,
    entityType: ENTITY_TYPE.GIFT_CARD,
    entityId: giftCard.id,
    branchId: giftCard.cinema_id,
    metadata: { code: giftCard.code },
  });

  res.json(updated);
}

module.exports = { list, mine, history, issue, redeem, validate, pay, update, block };
