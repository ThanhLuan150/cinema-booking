const promotionRepository = require('../repositories/promotion.repository');
const Promotion = require('../models/Promotion');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { isPromotionEligible, computePromotionDiscount } = require('../utils/promotionPricing');

const DISCOUNT_TYPES = Object.values(Promotion.DISCOUNT_TYPE);
const STATUSES = Object.values(Promotion.STATUS);
const SCOPE_FIELDS = ['branch_ids', 'movie_ids', 'showtime_ids', 'combo_ids'];

const INELIGIBILITY_MESSAGES = {
  PROMOTION_INACTIVE: 'Promotion is not active',
  PROMOTION_NOT_YET_VALID: 'Promotion is not valid yet',
  PROMOTION_EXPIRED: 'Promotion has expired',
  PROMOTION_USAGE_LIMIT_REACHED: 'Promotion has reached its usage limit',
  PROMOTION_CUSTOMER_LIMIT_REACHED: 'You have already used this promotion the maximum number of times',
  PROMOTION_BRANCH_NOT_ELIGIBLE: 'Promotion is not applicable to this branch',
  PROMOTION_MOVIE_NOT_ELIGIBLE: 'Promotion is not applicable to this movie',
  PROMOTION_SHOWTIME_NOT_ELIGIBLE: 'Promotion is not applicable to this showtime',
  PROMOTION_COMBO_NOT_ELIGIBLE: 'Promotion is not applicable to the combos in this order',
};

function normalizeIdArray(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const numbers = value.map(Number);
  if (numbers.some((n) => Number.isNaN(n))) return null;
  return [...new Set(numbers)];
}

// A BRANCH-scope caller may only manage a promotion scoped to branch(es) they own; a
// system-wide promotion (every scope array empty) is admin-only. ALL scope always passes.
async function canManagePromotion(req, branchIds) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchIds || branchIds.length === 0) return false;
  const ownedIds = await promotionRepository.findOwnedCinemaIds(req.account.accountId);
  return branchIds.every((id) => ownedIds.includes(id));
}

// Viewing is looser than managing: a BRANCH-scope caller can see their own branches'
// promotions plus every system-wide one (it may apply to their bookings too).
async function canViewPromotion(req, promotion) {
  if (req.permissionScope === 'ALL') return true;
  if (promotion.branch_ids.length === 0) return true;
  const ownedIds = await promotionRepository.findOwnedCinemaIds(req.account.accountId);
  return promotion.branch_ids.some((id) => ownedIds.includes(id));
}

function validateDiscount(discountType, discountValue) {
  if (!DISCOUNT_TYPES.includes(discountType)) {
    return `discount_type must be one of ${DISCOUNT_TYPES.join(', ')}`;
  }
  if (!(Number(discountValue) > 0)) return 'discount_value must be greater than 0';
  if (discountType === Promotion.DISCOUNT_TYPE.PERCENTAGE && Number(discountValue) > 100) {
    return 'discount_value must not exceed 100 for a percentage discount';
  }
  return null;
}

// GET /api/promotion?branchId=&status=&page=&limit= -> management view (BRANCH scope sees only
// their own branches' promotions plus system-wide ones; ALL scope sees everything)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;

  if (req.permissionScope === 'BRANCH') {
    const ownedIds = await promotionRepository.findOwnedCinemaIds(req.account.accountId);
    if (req.query.branchId) {
      filter.branch_ids = ownedIds.includes(Number(req.query.branchId)) ? Number(req.query.branchId) : -1;
    } else {
      filter.$or = [{ branch_ids: { $in: ownedIds } }, { branch_ids: { $size: 0 } }];
    }
  } else if (req.query.branchId) {
    filter.branch_ids = Number(req.query.branchId);
  }

  const { data, total } = await promotionRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/promotion/:id
async function getById(req, res) {
  const promotion = await promotionRepository.findById(req.params.id);
  if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
  if (!(await canViewPromotion(req, promotion))) return res.status(403).json({ message: 'Forbidden' });
  res.json(promotion);
}

// POST /api/promotion/validate { code, branch_id, movie_id, showtime_id, combo_ids, order_value }
// -> (auth) checks a code against every business rule and returns the backend-computed discount,
// WITHOUT consuming a use. The frontend must never invent its own discount_amount.
async function validate(req, res) {
  const { code, branch_id, movie_id, showtime_id, combo_ids, order_value } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const promotion = await promotionRepository.findByCode(code);
  if (!promotion) {
    return res.status(404).json({ message: 'Promotion code does not exist', code: 'PROMOTION_NOT_FOUND' });
  }

  const usage = await promotionRepository.findUsage(promotion.id, req.account.accountId);
  const eligibility = isPromotionEligible(promotion, {
    branchId: branch_id,
    movieId: movie_id,
    showtimeId: showtime_id,
    comboIds: Array.isArray(combo_ids) ? combo_ids : [],
    orderValue: order_value,
    customerUsedCount: usage ? usage.count : 0,
  });

  if (!eligibility.eligible) {
    return res.status(400).json({
      message:
        INELIGIBILITY_MESSAGES[eligibility.reason] ||
        `Minimum order of ${promotion.minimum_order_value} required to apply this code`,
      code: eligibility.reason,
      ...(eligibility.reason === 'PROMOTION_MIN_ORDER_NOT_MET' ? { minimumOrderValue: promotion.minimum_order_value } : {}),
    });
  }

  res.json({
    code: promotion.code,
    discount_type: promotion.discount_type,
    discount_value: promotion.discount_value,
    discount_amount: computePromotionDiscount(promotion, order_value),
  });
}

// POST /api/promotion/apply { code, branch_id, movie_id, showtime_id, combo_ids, order_value }
// -> (auth) same eligibility + discount computation as /validate, but also records one use
// against the promotion and the caller. Meant to be called once an order is actually finalized.
async function apply(req, res) {
  const { code, branch_id, movie_id, showtime_id, combo_ids, order_value } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const promotion = await promotionRepository.findByCode(code);
  if (!promotion) {
    return res.status(404).json({ message: 'Promotion code does not exist', code: 'PROMOTION_NOT_FOUND' });
  }

  const usage = await promotionRepository.findUsage(promotion.id, req.account.accountId);
  const eligibility = isPromotionEligible(promotion, {
    branchId: branch_id,
    movieId: movie_id,
    showtimeId: showtime_id,
    comboIds: Array.isArray(combo_ids) ? combo_ids : [],
    orderValue: order_value,
    customerUsedCount: usage ? usage.count : 0,
  });

  if (!eligibility.eligible) {
    return res.status(400).json({
      message:
        INELIGIBILITY_MESSAGES[eligibility.reason] ||
        `Minimum order of ${promotion.minimum_order_value} required to apply this code`,
      code: eligibility.reason,
      ...(eligibility.reason === 'PROMOTION_MIN_ORDER_NOT_MET' ? { minimumOrderValue: promotion.minimum_order_value } : {}),
    });
  }

  const discountAmount = computePromotionDiscount(promotion, order_value);
  await promotionRepository.recordUsage(promotion.id, req.account.accountId);

  res.json({
    code: promotion.code,
    discount_type: promotion.discount_type,
    discount_value: promotion.discount_value,
    discount_amount: discountAmount,
  });
}

// POST /api/promotion { code, name, discount_type, discount_value, start_at, end_at, ... }
// (promotion.create permission; every scope array empty = system-wide, admin only)
async function create(req, res) {
  const {
    code,
    name,
    description,
    discount_type,
    discount_value,
    minimum_order_value,
    maximum_discount,
    start_at,
    end_at,
    usage_limit,
    per_customer_limit,
    status,
  } = req.body;

  if (!code || !name || !discount_type || discount_value === undefined || !start_at || !end_at) {
    return res.status(400).json({ message: 'code, name, discount_type, discount_value, start_at and end_at are required' });
  }

  const discountError = validateDiscount(discount_type, discount_value);
  if (discountError) return res.status(400).json({ message: discountError });

  const startAt = new Date(start_at);
  const endAt = new Date(end_at);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
    return res.status(400).json({ message: 'start_at must be a valid date before end_at' });
  }

  const normalizedScopes = {};
  for (const field of SCOPE_FIELDS) {
    const normalized = normalizeIdArray(req.body[field]);
    if (normalized === null) return res.status(400).json({ message: `${field} must be an array of ids` });
    normalizedScopes[field] = normalized ?? [];
  }

  if (!(await canManagePromotion(req, normalizedScopes.branch_ids))) {
    return res.status(403).json({
      message: normalizedScopes.branch_ids.length === 0 ? 'Only admin can create a system-wide promotion' : 'Forbidden',
    });
  }

  const existing = await promotionRepository.findByCode(code);
  if (existing) return res.status(400).json({ message: 'Promotion code already exists', code: 'PROMOTION_CODE_EXISTS' });

  const id = await nextId('promotion');
  const promotion = await promotionRepository.create({
    id,
    code: String(code).toUpperCase(),
    name,
    description: description || '',
    discount_type,
    discount_value: Number(discount_value),
    minimum_order_value: minimum_order_value ? Number(minimum_order_value) : 0,
    maximum_discount: maximum_discount !== undefined && maximum_discount !== null ? Number(maximum_discount) : null,
    start_at: startAt,
    end_at: endAt,
    usage_limit: usage_limit !== undefined && usage_limit !== null ? Number(usage_limit) : null,
    per_customer_limit: per_customer_limit !== undefined && per_customer_limit !== null ? Number(per_customer_limit) : null,
    status: STATUSES.includes(status) ? status : Promotion.STATUS.ACTIVE,
    ...normalizedScopes,
  });
  res.status(201).json(promotion);
}

// PUT /api/promotion/:id (promotion.update permission, scoped to the promotion's own branches)
async function update(req, res) {
  const promotion = await promotionRepository.findById(req.params.id);
  if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
  if (!(await canManagePromotion(req, promotion.branch_ids))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updates = {};
  const simpleFields = [
    'name',
    'description',
    'minimum_order_value',
    'maximum_discount',
    'usage_limit',
    'per_customer_limit',
  ];
  for (const field of simpleFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}` });
    updates.status = req.body.status;
  }

  if (req.body.discount_type !== undefined || req.body.discount_value !== undefined) {
    const finalDiscountType = req.body.discount_type ?? promotion.discount_type;
    const finalDiscountValue = req.body.discount_value ?? promotion.discount_value;
    const discountError = validateDiscount(finalDiscountType, finalDiscountValue);
    if (discountError) return res.status(400).json({ message: discountError });
    if (req.body.discount_type !== undefined) updates.discount_type = finalDiscountType;
    if (req.body.discount_value !== undefined) updates.discount_value = Number(finalDiscountValue);
  }

  if (req.body.start_at !== undefined || req.body.end_at !== undefined) {
    const startAt = req.body.start_at !== undefined ? new Date(req.body.start_at) : promotion.start_at;
    const endAt = req.body.end_at !== undefined ? new Date(req.body.end_at) : promotion.end_at;
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      return res.status(400).json({ message: 'start_at must be a valid date before end_at' });
    }
    if (req.body.start_at !== undefined) updates.start_at = startAt;
    if (req.body.end_at !== undefined) updates.end_at = endAt;
  }

  for (const field of SCOPE_FIELDS) {
    if (req.body[field] === undefined) continue;
    const normalized = normalizeIdArray(req.body[field]);
    if (normalized === null) return res.status(400).json({ message: `${field} must be an array of ids` });
    updates[field] = normalized;
  }

  if (updates.branch_ids !== undefined && !(await canManagePromotion(req, updates.branch_ids))) {
    return res.status(403).json({
      message: updates.branch_ids.length === 0 ? 'Only admin can make a promotion system-wide' : 'Forbidden',
    });
  }

  const updated = await promotionRepository.updateFields(promotion.id, updates);
  res.json(updated);
}

// DELETE /api/promotion/:id (promotion.delete permission, scoped)
async function remove(req, res) {
  const promotion = await promotionRepository.findById(req.params.id);
  if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
  if (!(await canManagePromotion(req, promotion.branch_ids))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await promotionRepository.remove(promotion.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, validate, apply, create, update, remove };
