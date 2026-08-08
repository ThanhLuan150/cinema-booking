const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const userController = require('../controllers/user.controller');

const router = express.Router();

// GET /api/user  (current authenticated account, resolved from the JWT)
router.get('/user', requireAuth, asyncHandler(userController.me));

// PUT /api/user  (update the caller's own profile: name, phone, avatar)
router.put('/user', requireAuth, asyncHandler(userController.updateMe));

// GET /api/users (user.read permission)
router.get('/users', requireAuth, requirePermission('user.read'), asyncHandler(userController.list));

// GET /api/users/:id (user.read permission)
router.get('/users/:id', requireAuth, requirePermission('user.read'), asyncHandler(userController.getById));

// DELETE /api/users/:id (user.delete permission)
router.delete('/users/:id', requireAuth, requirePermission('user.delete'), asyncHandler(userController.remove));

// PUT /api/block/:id (user.block permission)
router.put('/block/:id', requireAuth, requirePermission('user.block'), asyncHandler(userController.block));

// PUT /api/unblock/:id { status: 1 } (user.block permission)
router.put('/unblock/:id', requireAuth, requirePermission('user.block'), asyncHandler(userController.unblock));

// PUT /api/users/:id/approve (user.approve permission) — approve a pending theater-staff account directly,
// without needing to find and approve its cinema from the Cinemas page first.
router.put('/users/:id/approve', requireAuth, requirePermission('user.approve'), asyncHandler(userController.approve));

// PUT /api/users/:id/role { role } (user.update permission) — reassign a user's role (0=admin, 1=user, 2=theater staff)
router.put('/users/:id/role', requireAuth, requirePermission('user.update'), asyncHandler(userController.updateRole));

module.exports = router;
