const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const notificationController = require('../controllers/notification.controller');

const router = express.Router();

// Ticket 25 — a caller's own notification feed. Auth alone is enough: there is no RBAC
// permission because every row is personal and the controller filters by req.account.accountId.
// No POST/PUT/DELETE — notifications are server-raised and kept as history.

router.get('/', requireAuth, asyncHandler(notificationController.list));
router.get('/unread-count', requireAuth, asyncHandler(notificationController.unreadCount));
// read-all must precede /:id/read so "read-all" isn't parsed as an id segment.
router.patch('/read-all', requireAuth, asyncHandler(notificationController.markAllRead));
router.patch('/:id/read', requireAuth, asyncHandler(notificationController.markRead));

module.exports = router;
