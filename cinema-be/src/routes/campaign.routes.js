const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const campaignController = require('../controllers/campaign.controller');

const router = express.Router();

router.get('/public', asyncHandler(campaignController.publicFeed));

// --- Admin -------------------------------------------------------------------
router.get('/meta', requireAuth, requirePermission('campaign.read'), asyncHandler(campaignController.meta));

router.get('/', requireAuth, requirePermission('campaign.read'), asyncHandler(campaignController.list));
router.get('/:id', requireAuth, requirePermission('campaign.read'), asyncHandler(campaignController.getById));

router.post('/', requireAuth, requirePermission('campaign.manage'), asyncHandler(campaignController.create));
router.put('/:id', requireAuth, requirePermission('campaign.manage'), asyncHandler(campaignController.update));
router.delete('/:id', requireAuth, requirePermission('campaign.manage'), asyncHandler(campaignController.remove));

// Fire the announcement blast. Separate permission so a Branch Admin can be allowed to build
// campaigns without also being allowed to message every customer.
router.post('/:id/notify', requireAuth, requirePermission('campaign.notify'), asyncHandler(campaignController.notify));

// --- Banners (nested under a campaign) --------------------------------------
router.get(
  '/:id/banners',
  requireAuth,
  requirePermission('campaign.read'),
  asyncHandler(campaignController.listBanners),
);
router.post(
  '/:id/banners',
  requireAuth,
  requirePermission('campaign.manage'),
  asyncHandler(campaignController.createBanner),
);
router.put(
  '/banners/:bannerId',
  requireAuth,
  requirePermission('campaign.manage'),
  asyncHandler(campaignController.updateBanner),
);
router.delete(
  '/banners/:bannerId',
  requireAuth,
  requirePermission('campaign.manage'),
  asyncHandler(campaignController.removeBanner),
);

module.exports = router;
