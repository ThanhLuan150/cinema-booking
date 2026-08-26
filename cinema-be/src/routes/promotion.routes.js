const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const promotionController = require('../controllers/promotion.controller');

const router = express.Router();

// GET /api/promotion?branchId=&status= -> management list (owner sees only their own branches'
// promotions plus system-wide ones, admin sees all)
router.get('/', requireAuth, requirePermission('promotion.read'), asyncHandler(promotionController.list));

// GET /api/promotion/:id
router.get('/:id', requireAuth, requirePermission('promotion.read'), asyncHandler(promotionController.getById));

// POST /api/promotion/validate { code, branch_id, movie_id, showtime_id, combo_ids, order_value }
// -> (auth) previews a code's eligibility + backend-computed discount, without consuming a use
router.post('/validate', requireAuth, asyncHandler(promotionController.validate));

// POST /api/promotion/apply { code, ... same as validate } -> (auth) same checks, and records
// one use against the promotion + the caller. Call this once an order is actually finalized.
router.post('/apply', requireAuth, asyncHandler(promotionController.apply));

// POST /api/promotion (promotion.create permission; every scope array empty = admin only)
router.post('/', requireAuth, requirePermission('promotion.create'), asyncHandler(promotionController.create));

// PUT /api/promotion/:id (promotion.update permission, scoped)
router.put('/:id', requireAuth, requirePermission('promotion.update'), asyncHandler(promotionController.update));

// DELETE /api/promotion/:id (promotion.delete permission, scoped)
router.delete('/:id', requireAuth, requirePermission('promotion.delete'), asyncHandler(promotionController.remove));

module.exports = router;
