const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const userController = require('../controllers/user.controller');

const router = express.Router();

// GET /api/user  (current authenticated account, resolved from the JWT)
router.get('/user', requireAuth, asyncHandler(userController.me));

// PUT /api/user  (update the caller's own profile: name, phone, avatar)
router.put('/user', requireAuth, asyncHandler(userController.updateMe));

// GET /api/users (admin only)
router.get('/users', requireAuth, requireRole(0), asyncHandler(userController.list));

// GET /api/users/:id (admin only)
router.get('/users/:id', requireAuth, requireRole(0), asyncHandler(userController.getById));

// DELETE /api/users/:id (admin only)
router.delete('/users/:id', requireAuth, requireRole(0), asyncHandler(userController.remove));

// PUT /api/block/:id (admin only)
router.put('/block/:id', requireAuth, requireRole(0), asyncHandler(userController.block));

// PUT /api/unblock/:id { status: 1 } (admin only)
router.put('/unblock/:id', requireAuth, requireRole(0), asyncHandler(userController.unblock));

// PUT /api/users/:id/approve (admin only) — approve a pending theater-staff account directly,
// without needing to find and approve its cinema from the Cinemas page first.
router.put('/users/:id/approve', requireAuth, requireRole(0), asyncHandler(userController.approve));

// PUT /api/users/:id/role { role } (admin only) — reassign a user's role (0=admin, 1=user, 2=theater staff)
router.put('/users/:id/role', requireAuth, requireRole(0), asyncHandler(userController.updateRole));

module.exports = router;
