const voucherRepository = require('../repositories/voucher.repository');
const bookingRepository = require('../repositories/booking.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { isVoucherEligible, computeVoucherDiscount } = require('../utils/voucherPricing');
const Voucher = require('../models/Voucher');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const DISCOUNT_TYPES = Object.values(Voucher.DISCOUNT_TYPE);
const FREE_TYPES = [Voucher.DISCOUNT_TYPE.FREE_TICKET, Voucher.DISCOUNT_TYPE.FREE_COMBO];

const INELIGIBILITY_MESSAGES = {
  VOUCHER_WRONG_CINEMA: 'Voucher is not applicable to this cinema',
  VOUCHER_NOT_YET_VALID: 'Voucher is not valid yet',
  VOUCHER_EXPIRED: 'Voucher has expired',
  VOUCHER_USES_EXHAUSTED: 'Voucher has reached its usage limit',
  VOUCHER_COMBO_NOT_ELIGIBLE: 'This voucher only applies to a specific combo in your order',
};

// A BRANCH-scope caller may only touch vouchers on a cinema they own; ALL scope always passes.
async function assertCinemaOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchId) return false;
  const cinema = await voucherRepository.findCinemaById(branchId);
  return Boolean(cinema && cinema.owner_id === req.account.accountId);
}

function validateDiscount(discountType, discountValue) {
  if (!DISCOUNT_TYPES.includes(discountType)) {
    return `discount_type must be one of ${DISCOUNT_TYPES.join(', ')}`;
  }
  if (discountType === Voucher.DISCOUNT_TYPE.PERCENTAGE) {
    if (!(Number(discountValue) >= 1 && Number(discountValue) <= 100)) {
      return 'discount_value must be between 1 and 100 for a percentage voucher';
    }
  } else if (discountType === Voucher.DISCOUNT_TYPE.FIXED_AMOUNT) {
    if (!(Number(discountValue) > 0)) return 'discount_value must be greater than 0';
  }
  return null;
}

function validateFreeQuantity(discountType, freeQuantity) {
  if (FREE_TYPES.includes(discountType) && !(Number(freeQuantity) >= 1)) {
    return 'free_quantity must be at least 1 for this discount_type';
  }
  return null;
}

// GET /api/voucher?branchId= -> management view (owner sees only their own cinemas' vouchers, admin sees all)
async function list(req, res) {
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const ownedIds = await voucherRepository.findOwnedCinemaIds(req.account.accountId);
    filter.cinema_id = req.query.branchId
      ? ownedIds.includes(Number(req.query.branchId))
        ? Number(req.query.branchId)
        : -1
      : { $in: ownedIds };
  } else if (req.query.branchId) {
    filter.cinema_id = Number(req.query.branchId);
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await voucherRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/voucher/:id/history -> usage history (owner/admin, scoped to the voucher's own cinema)
async function history(req, res) {
  const voucher = await voucherRepository.findById(req.params.id);
  if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
  if (!(await assertCinemaOwnership(req, voucher.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await voucherRepository.findUsageHistory(voucher.id, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/voucher/validate { code, cinema_id, order_value, ticket_ids?, combo_ids? } -> (auth)
// checks a code without consuming it. FIXED_AMOUNT/PERCENTAGE can be previewed from a plain
// order_value; FREE_TICKET/FREE_COMBO need the order's real ticket/combo ids so the discount is
// computed from backend-priced items, never trusted from the frontend.
async function validate(req, res) {
  const { code, cinema_id, order_value, ticket_ids, combo_ids } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const voucher = await voucherRepository.findByCode(code);
  if (!voucher) return res.status(404).json({ message: 'Voucher code does not exist', code: 'VOUCHER_NOT_FOUND' });

  let effectiveCinemaId = cinema_id;
  let effectiveOrderValue = order_value;
  let ticketPrices = [];
  let combos = [];
  const comboIds = Array.isArray(combo_ids) ? combo_ids : [];

  if (Array.isArray(ticket_ids) && ticket_ids.length > 0) {
    const priced = await bookingRepository.priceOrderItems({ ticketIds: ticket_ids, comboIds });
    if (!priced) return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });
    effectiveCinemaId = priced.cinemaId;
    effectiveOrderValue = priced.orderValue;
    ticketPrices = priced.ticketPrices;
    combos = priced.combos;
  } else if (FREE_TYPES.includes(voucher.discount_type)) {
    return res.status(400).json({
      message: 'ticket_ids is required to preview this voucher',
      code: 'VOUCHER_TICKET_CONTEXT_REQUIRED',
    });
  }

  const eligibility = isVoucherEligible(voucher, { cinemaId: effectiveCinemaId, orderValue: effectiveOrderValue, comboIds });
  if (!eligibility.eligible) {
    return res.status(400).json({
      message: INELIGIBILITY_MESSAGES[eligibility.reason] || `Minimum order of ${voucher.min_order_value} required to apply this code`,
      code: eligibility.reason,
      ...(eligibility.reason === 'VOUCHER_MIN_ORDER_NOT_MET' ? { minOrderValue: voucher.min_order_value } : {}),
    });
  }

  const discount = computeVoucherDiscount(voucher, effectiveOrderValue, { ticketPrices, combos });

  res.json({
    code: voucher.code,
    discount_type: voucher.discount_type,
    discount_value: voucher.discount_value,
    discount_amount: discount,
  });
}

// POST /api/voucher { cinema_id, code, discount_type, discount_value, free_quantity, combo_id, ... }
// (owner/admin; cinema_id null = admin only)
async function create(req, res) {
  const {
    cinema_id,
    code,
    discount_type,
    discount_value,
    free_quantity,
    combo_id,
    max_uses,
    valid_from,
    valid_to,
    min_order_value,
  } = req.body;
  if (!code || !discount_type) {
    return res.status(400).json({ message: 'code and discount_type are required' });
  }

  const isFreeType = FREE_TYPES.includes(discount_type);
  if (!isFreeType && discount_value === undefined) {
    return res.status(400).json({ message: 'discount_value is required for this discount_type' });
  }

  const discountError = validateDiscount(discount_type, isFreeType ? 0 : discount_value);
  if (discountError) return res.status(400).json({ message: discountError });

  const quantityError = validateFreeQuantity(discount_type, free_quantity);
  if (quantityError) return res.status(400).json({ message: quantityError });

  const normalizedCinemaId = cinema_id === undefined || cinema_id === null ? null : Number(cinema_id);
  if (normalizedCinemaId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only admin can create system-wide vouchers' });
  }
  if (normalizedCinemaId !== null && !(await assertCinemaOwnership(req, normalizedCinemaId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('voucher');
  let voucher;
  try {
    voucher = await voucherRepository.create({
      id,
      cinema_id: normalizedCinemaId,
      code: String(code).toUpperCase(),
      discount_type,
      discount_value: isFreeType ? 0 : Number(discount_value),
      free_quantity: isFreeType ? Number(free_quantity) : null,
      combo_id:
        discount_type === Voucher.DISCOUNT_TYPE.FREE_COMBO && combo_id !== undefined && combo_id !== null
          ? Number(combo_id)
          : null,
      max_uses: max_uses !== undefined && max_uses !== null ? Number(max_uses) : null,
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_to: valid_to ? new Date(valid_to) : null,
      min_order_value: min_order_value ? Number(min_order_value) : 0,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'Voucher code already exists', code: 'VOUCHER_CODE_EXISTS' });
    }
    throw err;
  }

  await recordAudit({
    req,
    action: ACTION.VOUCHER_CREATED,
    entityType: ENTITY_TYPE.VOUCHER,
    entityId: voucher.id,
    branchId: normalizedCinemaId,
    metadata: { code: voucher.code, discount_type: voucher.discount_type },
  });

  res.status(201).json(voucher);
}

// PUT /api/voucher/:id (owner/admin, scoped)
async function update(req, res) {
  const voucher = await voucherRepository.findById(req.params.id);
  if (!voucher) return res.status(404).json({ message: 'Voucher not found' });

  if (!(await assertCinemaOwnership(req, voucher.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updates = {};
  const simpleFields = ['max_uses', 'valid_from', 'valid_to', 'min_order_value', 'active', 'combo_id'];
  for (const field of simpleFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (req.body.discount_type !== undefined || req.body.discount_value !== undefined || req.body.free_quantity !== undefined) {
    const finalType = req.body.discount_type ?? voucher.discount_type;
    const isFreeType = FREE_TYPES.includes(finalType);
    const finalValue = req.body.discount_value ?? (isFreeType ? 0 : voucher.discount_value);

    const discountError = validateDiscount(finalType, isFreeType ? 0 : finalValue);
    if (discountError) return res.status(400).json({ message: discountError });

    const finalQuantity = req.body.free_quantity ?? voucher.free_quantity;
    const quantityError = validateFreeQuantity(finalType, finalQuantity);
    if (quantityError) return res.status(400).json({ message: quantityError });

    if (req.body.discount_type !== undefined) updates.discount_type = finalType;
    updates.discount_value = isFreeType ? 0 : Number(finalValue);
    updates.free_quantity = isFreeType ? Number(finalQuantity) : null;
  }

  const updated = await voucherRepository.updateFields(voucher.id, updates);

  await recordAudit({
    req,
    action: ACTION.VOUCHER_UPDATED,
    entityType: ENTITY_TYPE.VOUCHER,
    entityId: voucher.id,
    branchId: voucher.cinema_id,
    metadata: { code: voucher.code, updates: Object.keys(updates) },
  });

  res.json(updated);
}

// DELETE /api/voucher/:id (owner/admin, scoped)
async function remove(req, res) {
  const voucher = await voucherRepository.findById(req.params.id);
  if (!voucher) return res.status(404).json({ message: 'Voucher not found' });

  if (!(await assertCinemaOwnership(req, voucher.cinema_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await voucherRepository.remove(voucher.id);

  await recordAudit({
    req,
    action: ACTION.VOUCHER_DELETED,
    entityType: ENTITY_TYPE.VOUCHER,
    entityId: voucher.id,
    branchId: voucher.cinema_id,
    metadata: { code: voucher.code },
  });

  res.json({ message: 'Deleted' });
}

module.exports = { list, history, validate, create, update, remove };
