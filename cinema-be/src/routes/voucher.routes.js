const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const voucherController = require('../controllers/voucher.controller');

const router = express.Router();

// GET /api/voucher?cinemaId= -> management view (owner sees only their own cinemas' vouchers, admin sees all)
router.get('/', requireAuth, requireRole(0, 2), asyncHandler(voucherController.list));

// POST /api/voucher/validate { code, cinema_id, order_value } -> (auth) checks a code without consuming it
router.post('/validate', requireAuth, asyncHandler(voucherController.validate));

// POST /api/voucher { cinema_id, code, discount_type, discount_value, ... } (owner/admin; cinema_id null = admin only)
router.post('/', requireAuth, requireRole(0, 2), asyncHandler(voucherController.create));

// PUT /api/voucher/:id (owner/admin, scoped)
router.put('/:id', requireAuth, requireRole(0, 2), asyncHandler(voucherController.update));

// DELETE /api/voucher/:id (owner/admin, scoped)
router.delete('/:id', requireAuth, requireRole(0, 2), asyncHandler(voucherController.remove));

module.exports = router;
