const loyaltyService = require('../services/loyaltyService');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/loyalty/me -> the caller's membership tier + points summary
async function mySummary(req, res) {
  const summary = await loyaltyService.getSummary(req.account.accountId);
  if (!summary) return res.status(404).json({ message: 'Account not found' });
  res.json(summary);
}

// GET /api/loyalty/me/transactions?page=&limit= -> the caller's points history, newest first
async function myTransactions(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await loyaltyService.listTransactions(req.account.accountId, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/loyalty/redeem { points, description }
async function redeem(req, res) {
  const { points, description } = req.body || {};
  const result = await loyaltyService.redeemPoints({ accountId: req.account.accountId, points, description });
  if (result.error) {
    return res.status(400).json({ message: result.message, code: result.error });
  }
  res.status(201).json(result);
}

// GET /api/loyalty/config (admin only)
async function getConfigHandler(req, res) {
  res.json(await loyaltyService.getConfig());
}

// PUT /api/loyalty/config (admin only)
async function updateConfigHandler(req, res) {
  const fields = ['amount_per_point', 'points_expiry_days', 'redeem_value_per_point', 'min_redeem_points'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.amount_per_point !== undefined && !(Number(updates.amount_per_point) > 0)) {
    return res.status(400).json({ message: 'amount_per_point must be greater than 0' });
  }
  if (updates.redeem_value_per_point !== undefined && !(Number(updates.redeem_value_per_point) >= 0)) {
    return res.status(400).json({ message: 'redeem_value_per_point must be >= 0' });
  }
  if (updates.min_redeem_points !== undefined && !(Number(updates.min_redeem_points) >= 0)) {
    return res.status(400).json({ message: 'min_redeem_points must be >= 0' });
  }
  if (
    updates.points_expiry_days !== undefined &&
    updates.points_expiry_days !== null &&
    !(Number(updates.points_expiry_days) > 0)
  ) {
    return res.status(400).json({ message: 'points_expiry_days must be a positive number or null' });
  }

  const updated = await loyaltyService.updateConfig(updates, req.account.accountId);
  res.json(updated);
}

// POST /api/loyalty/:accountId/adjust { amount, description } (admin only) — manual correction
async function adjust(req, res) {
  const { amount, description } = req.body || {};
  const result = await loyaltyService.adjustPoints({
    accountId: req.params.accountId,
    amount,
    description,
    createdBy: req.account.accountId,
  });
  if (result.error) {
    const status = result.error === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ message: result.message, code: result.error });
  }
  res.status(201).json(result);
}

module.exports = { mySummary, myTransactions, redeem, getConfigHandler, updateConfigHandler, adjust };
