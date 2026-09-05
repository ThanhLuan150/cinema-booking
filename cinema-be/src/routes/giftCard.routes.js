const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const giftCardController = require('../controllers/giftCard.controller');

const router = express.Router();

// GET /api/gift-cards?branchId= -> management view (owner sees only their own cinemas' cards, admin sees all)
router.get('/', requireAuth, requirePermission('giftCard.read'), asyncHandler(giftCardController.list));

// GET /api/gift-cards/mine -> (giftCard.read permission; CUSTOMER is granted OWN scope) the
// caller's own redeemed gift cards
router.get('/mine', requireAuth, requirePermission('giftCard.read'), asyncHandler(giftCardController.mine));

// POST /api/gift-cards/redeem { code } -> (auth) claims an unowned gift card into the caller's account
router.post('/redeem', requireAuth, asyncHandler(giftCardController.redeem));

// POST /api/gift-cards/validate { code, order_value } -> (auth) previews the applicable amount, no mutation
router.post('/validate', requireAuth, asyncHandler(giftCardController.validate));

// POST /api/gift-cards/pay { code, ticketIds, comboIds } -> (auth) pays for a held order with the card's balance
router.post('/pay', requireAuth, asyncHandler(giftCardController.pay));

// GET /api/gift-cards/:id/history -> (giftCard.read permission) usage history — the card's own
// owner (CUSTOMER, OWN scope), or a scoped admin/branch-owner (BRANCH/ALL scope)
router.get('/:id/history', requireAuth, requirePermission('giftCard.read'), asyncHandler(giftCardController.history));

// POST /api/gift-cards { code, cinema_id, initial_balance, ... } (giftCard.create permission; cinema_id null = admin only)
router.post('/', requireAuth, requirePermission('giftCard.create'), asyncHandler(giftCardController.issue));

// PUT /api/gift-cards/:id (giftCard.update permission, scoped)
router.put('/:id', requireAuth, requirePermission('giftCard.update'), asyncHandler(giftCardController.update));

// POST /api/gift-cards/:id/block (giftCard.update permission, scoped)
router.post('/:id/block', requireAuth, requirePermission('giftCard.update'), asyncHandler(giftCardController.block));

module.exports = router;
