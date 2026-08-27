const notificationRepository = require('../repositories/notification.repository');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// Ticket 25 — the customer-facing notification history. Every endpoint is scoped to the
// authenticated caller's own account; there is deliberately no "create" endpoint (notifications
// are raised by the server itself via notification.service).

// GET /api/notifications?unread=true&status=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await notificationRepository.findForAccount(req.account.accountId, {
    unread: req.query.unread === 'true' || req.query.unread === '1',
    status: req.query.status,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/notifications/unread-count -> { count }
async function unreadCount(req, res) {
  const count = await notificationRepository.countUnread(req.account.accountId);
  res.json({ count });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const updated = await notificationRepository.markRead(req.params.id, req.account.accountId);
  if (!updated) return res.status(404).json({ message: 'Notification not found' });
  res.json(updated);
}

// PATCH /api/notifications/read-all -> { updated }
async function markAllRead(req, res) {
  const updated = await notificationRepository.markAllRead(req.account.accountId);
  res.json({ updated });
}

module.exports = { list, unreadCount, markRead, markAllRead };
