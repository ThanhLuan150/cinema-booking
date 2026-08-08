const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const roomRepository = require('../repositories/room.repository');
const roomController = require('../controllers/room.controller');

const router = express.Router();

// GET /api/room?branchId=
router.get('/', asyncHandler(roomController.list));

// POST /api/room { name, cinema_id } (room.create permission, owner-scoped)
router.post(
  '/',
  requireAuth,
  requirePermission('room.create'),
  requireBranchOwnership((req) => Number(req.body.cinema_id)),
  asyncHandler(roomController.create),
);

// PUT /api/room/:id { name } (room.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('room.update'),
  requireBranchOwnership((req) => roomRepository.findbranchIdByRoomId(req.params.id)),
  asyncHandler(roomController.update),
);

// DELETE /api/room/:id (room.delete permission, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('room.delete'),
  requireBranchOwnership((req) => roomRepository.findbranchIdByRoomId(req.params.id)),
  asyncHandler(roomController.remove),
);

module.exports = router;
