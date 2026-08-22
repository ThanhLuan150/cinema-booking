const voucherRepository = require('../repositories/voucher.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { isVoucherEligible, computeVoucherDiscount } = require('../utils/voucherPricing');

const INELIGIBILITY_MESSAGES = {
  VOUCHER_WRONG_CINEMA: 'Voucher is not applicable to this cinema',
  VOUCHER_NOT_YET_VALID: 'Voucher is not valid yet',
  VOUCHER_EXPIRED: 'Voucher has expired',
  VOUCHER_USES_EXHAUSTED: 'Voucher has reached its usage limit',
};

// A BRANCH-scope caller may only touch vouchers on a cinema they own; ALL scope always passes.
async function assertCinemaOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchId) return false;
  const cinema = await voucherRepository.findCinemaById(branchId);
  return Boolean(cinema && cinema.owner_id === req.account.accountId);
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

// POST /api/voucher/validate { code, cinema_id, order_value } -> (auth) checks a code without consuming it
async function validate(req, res) {
  const { code, cinema_id, order_value } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const voucher = await voucherRepository.findByCode(code);
  if (!voucher) return res.status(404).json({ message: 'Voucher code does not exist', code: 'VOUCHER_NOT_FOUND' });

  const eligibility = isVoucherEligible(voucher, { cinemaId: cinema_id, orderValue: order_value });
  if (!eligibility.eligible) {
    return res.status(400).json({
      message: INELIGIBILITY_MESSAGES[eligibility.reason] || `Minimum order of ${voucher.min_order_value} required to apply this code`,
      code: eligibility.reason,
      ...(eligibility.reason === 'VOUCHER_MIN_ORDER_NOT_MET' ? { minOrderValue: voucher.min_order_value } : {}),
    });
  }

  const discount = computeVoucherDiscount(voucher, order_value);

  res.json({
    code: voucher.code,
    discount_type: voucher.discount_type,
    discount_value: voucher.discount_value,
    discount_amount: discount,
  });
}

// POST /api/voucher { cinema_id, code, discount_type, discount_value, ... } (owner/admin; cinema_id null = admin only)
async function create(req, res) {
  const { cinema_id, code, discount_type, discount_value, max_uses, valid_from, valid_to, min_order_value } =
    req.body;
  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({ message: 'code, discount_type and discount_value are required' });
  }

  const normalizedCinemaId = cinema_id === undefined || cinema_id === null ? null : Number(cinema_id);
  if (normalizedCinemaId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only admin can create system-wide vouchers' });
  }
  if (normalizedCinemaId !== null && !(await assertCinemaOwnership(req, normalizedCinemaId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('voucher');
  const voucher = await voucherRepository.create({
    id,
    cinema_id: normalizedCinemaId,
    code: String(code).toUpperCase(),
    discount_type,
    discount_value: Number(discount_value),
    max_uses: max_uses !== undefined && max_uses !== null ? Number(max_uses) : null,
    valid_from: valid_from ? new Date(valid_from) : null,
    valid_to: valid_to ? new Date(valid_to) : null,
    min_order_value: min_order_value ? Number(min_order_value) : 0,
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

  const fields = ['discount_type', 'discount_value', 'max_uses', 'valid_from', 'valid_to', 'min_order_value', 'active'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const updated = await voucherRepository.updateFields(voucher.id, updates);
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
  res.json({ message: 'Deleted' });
}

module.exports = { list, validate, create, update, remove };
