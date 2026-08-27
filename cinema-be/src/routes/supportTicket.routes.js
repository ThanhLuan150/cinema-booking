const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const supportTicketRepository = require('../repositories/supportTicket.repository');
const supportTicketController = require('../controllers/supportTicket.controller');

const router = express.Router();

// GET /api/support-tickets?branchId=&status=&category=&customerId=&assignedEmployeeId= — an
// ALL-scope caller may omit branchId to see every branch; a BRANCH-scope caller (owner or staffed
// employee) must supply one they have access to.
function resolveListAccess(req, res, next) {
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchAccess((r) => Number(r.query.branchId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'branchId is required' });
  }
  req.branchId = null;
  next();
}

// GET /api/support-tickets (supportTicket.read permission, branch-scoped)
router.get('/', requireAuth, requirePermission('supportTicket.read'), resolveListAccess, asyncHandler(supportTicketController.list));

// GET /api/support-tickets/:id (supportTicket.read permission, branch-scoped)
router.get(
  '/:id',
  requireAuth,
  requirePermission('supportTicket.read'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.getById),
);

// POST /api/support-tickets { customer_id, branch_id, category?, subject, description? }
// (supportTicket.create permission, branch-scoped)
router.post(
  '/',
  requireAuth,
  requirePermission('supportTicket.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(supportTicketController.create),
);

// PUT /api/support-tickets/:id { subject, description, category } (supportTicket.update permission, branch-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('supportTicket.update'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.update),
);

// POST /api/support-tickets/:id/claim -> OPEN -> IN_PROGRESS, assigned to the caller (supportTicket.update permission, branch-scoped)
router.post(
  '/:id/claim',
  requireAuth,
  requirePermission('supportTicket.update'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.claim),
);

// POST /api/support-tickets/:id/assign { employee_id } (supportTicket.assign permission, branch-scoped)
router.post(
  '/:id/assign',
  requireAuth,
  requirePermission('supportTicket.assign'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.assign),
);

// POST /api/support-tickets/:id/resolve { resolution_note } -> IN_PROGRESS -> RESOLVED (supportTicket.update permission, branch-scoped)
router.post(
  '/:id/resolve',
  requireAuth,
  requirePermission('supportTicket.update'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.resolve),
);

// POST /api/support-tickets/:id/close -> RESOLVED -> CLOSED (supportTicket.close permission, branch-scoped)
router.post(
  '/:id/close',
  requireAuth,
  requirePermission('supportTicket.close'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.close),
);

// DELETE /api/support-tickets/:id (supportTicket.delete permission, branch-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('supportTicket.delete'),
  requireBranchAccess((req) => supportTicketRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(supportTicketController.remove),
);

module.exports = router;
