const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const loyaltyController = require('../controllers/loyalty.controller');
const membershipLevelController = require('../controllers/membershipLevel.controller');

const router = express.Router();

// GET /api/loyalty/me -> caller's membership tier + points summary
router.get('/loyalty/me', requireAuth, requirePermission('loyalty.read'), asyncHandler(loyaltyController.mySummary));

// GET /api/loyalty/me/transactions?page=&limit= -> caller's points history
router.get(
  '/loyalty/me/transactions',
  requireAuth,
  requirePermission('loyalty.read'),
  asyncHandler(loyaltyController.myTransactions),
);

// POST /api/loyalty/redeem { points, description }
router.post('/loyalty/redeem', requireAuth, requirePermission('loyalty.redeem'), asyncHandler(loyaltyController.redeem));

// GET/PUT /api/loyalty/config (admin only)
router.get(
  '/loyalty/config',
  requireAuth,
  requirePermission('loyaltyConfig.manage'),
  asyncHandler(loyaltyController.getConfigHandler),
);
router.put(
  '/loyalty/config',
  requireAuth,
  requirePermission('loyaltyConfig.manage'),
  asyncHandler(loyaltyController.updateConfigHandler),
);

// POST /api/loyalty/:accountId/adjust { amount, description } (admin only)
router.post(
  '/loyalty/:accountId/adjust',
  requireAuth,
  requirePermission('loyaltyConfig.manage'),
  asyncHandler(loyaltyController.adjust),
);

// GET /api/membership-levels -> every configured tier (any authenticated user)
router.get(
  '/membership-levels',
  requireAuth,
  requirePermission('membershipLevel.read'),
  asyncHandler(membershipLevelController.list),
);

// POST/PUT/DELETE /api/membership-levels (admin only)
router.post(
  '/membership-levels',
  requireAuth,
  requirePermission('membershipLevel.manage'),
  asyncHandler(membershipLevelController.create),
);
router.put(
  '/membership-levels/:id',
  requireAuth,
  requirePermission('membershipLevel.manage'),
  asyncHandler(membershipLevelController.update),
);
router.delete(
  '/membership-levels/:id',
  requireAuth,
  requirePermission('membershipLevel.manage'),
  asyncHandler(membershipLevelController.remove),
);

module.exports = router;
