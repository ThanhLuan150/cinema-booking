const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const voucherController = require('../controllers/voucher.controller');

const router = express.Router();

// GET /api/voucher?branchId= -> management view (owner sees only their own cinemas' vouchers, admin sees all)
router.get('/', requireAuth, requirePermission('voucher.read'), asyncHandler(voucherController.list));

// POST /api/voucher/validate { code, cinema_id, order_value } -> (auth) checks a code without consuming it
router.post('/validate', requireAuth, asyncHandler(voucherController.validate));

// POST /api/voucher { cinema_id, code, discount_type, discount_value, ... } (voucher.create permission; cinema_id null = admin only)
router.post('/', requireAuth, requirePermission('voucher.create'), asyncHandler(voucherController.create));

// PUT /api/voucher/:id (voucher.update permission, scoped)
router.put('/:id', requireAuth, requirePermission('voucher.update'), asyncHandler(voucherController.update));

// DELETE /api/voucher/:id (voucher.delete permission, scoped)
router.delete('/:id', requireAuth, requirePermission('voucher.delete'), asyncHandler(voucherController.remove));

module.exports = router;
