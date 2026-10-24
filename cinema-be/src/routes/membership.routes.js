const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const membershipController = require('../controllers/membership.controller');
const subscriptionPlanController = require('../controllers/subscriptionPlan.controller');
const subscriptionController = require('../controllers/subscription.controller');

const router = express.Router();

// --- Membership (the caller's own; no account id is ever taken from the request) ---------------
router.get('/membership/me', requireAuth, requirePermission('loyalty.read'), asyncHandler(membershipController.me));
router.post(
  '/membership/me/preview',
  requireAuth,
  requirePermission('booking.create'),
  asyncHandler(membershipController.preview),
);
router.get(
  '/membership/me/sale-access/:scheduleId',
  requireAuth,
  requirePermission('loyalty.read'),
  asyncHandler(membershipController.saleAccess),
);

// --- Subscription plans (catalogue) -------------------------------------------------------------
router.get(
  '/subscription-plans',
  requireAuth,
  requirePermission('subscriptionPlan.read'),
  asyncHandler(subscriptionPlanController.listActive),
);
router.get(
  '/subscription-plans/all',
  requireAuth,
  requirePermission('subscriptionPlan.manage'),
  asyncHandler(subscriptionPlanController.listAll),
);
router.post(
  '/subscription-plans',
  requireAuth,
  requirePermission('subscriptionPlan.manage'),
  asyncHandler(subscriptionPlanController.create),
);
router.put(
  '/subscription-plans/:id',
  requireAuth,
  requirePermission('subscriptionPlan.manage'),
  asyncHandler(subscriptionPlanController.update),
);
router.delete(
  '/subscription-plans/:id',
  requireAuth,
  requirePermission('subscriptionPlan.manage'),
  asyncHandler(subscriptionPlanController.remove),
);

// --- Subscriptions --------------------------------------------------------------------------------
router.post('/subscriptions', requireAuth, requirePermission('subscription.purchase'), asyncHandler(subscriptionController.purchase));
router.get('/subscriptions/me', requireAuth, requirePermission('subscription.read'), asyncHandler(subscriptionController.listMine));
router.get(
  '/subscriptions/me/:code',
  requireAuth,
  requirePermission('subscription.read'),
  asyncHandler(subscriptionController.getMine),
);
router.post(
  '/subscriptions/me/:code/cancel',
  requireAuth,
  requirePermission('subscription.purchase'),
  asyncHandler(subscriptionController.cancelMine),
);
router.post(
  '/subscriptions/me/:code/momo-confirm',
  requireAuth,
  requirePermission('subscription.purchase'),
  asyncHandler(subscriptionController.momoConfirm),
);
router.get('/subscriptions', requireAuth, requirePermission('subscription.manage'), asyncHandler(subscriptionController.listAll));
router.post(
  '/subscriptions/:id/cancel',
  requireAuth,
  requirePermission('subscription.manage'),
  asyncHandler(subscriptionController.adminCancel),
);

module.exports = router;
