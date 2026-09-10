const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const parkingRepository = require('../repositories/parking.repository');
const parkingController = require('../controllers/parking.controller');

const router = express.Router();

// GET list endpoints: an ALL-scope caller may omit branchId to see every branch; a BRANCH-scope
// caller must supply a branchId they can access.
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

// A slot has no branch_id of its own — it is branch-scoped through its area. A BRANCH-scope
// caller listing slots must scope by an areaId (or a branchId) they can access.
function resolveSlotListAccess(req, res, next) {
  if (req.query.areaId !== undefined && req.query.areaId !== '') {
    return requireBranchAccess((r) => parkingRepository.findBranchIdByAreaId(r.query.areaId))(req, res, next);
  }
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchAccess((r) => Number(r.query.branchId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'areaId or branchId is required' });
  }
  req.branchId = null;
  next();
}

async function branchIdOfSlotArea(req) {
  const slot = await parkingRepository.findSlotById(req.params.id);
  if (!slot) return null;
  return parkingRepository.findBranchIdByAreaId(slot.parking_area_id);
}

// ---- Parking areas --------------------------------------------------------

router.get('/areas', requireAuth, requirePermission('parking.read'), resolveListAccess, asyncHandler(parkingController.listAreas));

router.get(
  '/areas/:id',
  requireAuth,
  requirePermission('parking.read'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByAreaId(req.params.id)),
  asyncHandler(parkingController.getArea),
);

router.post(
  '/areas',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(parkingController.createArea),
);

router.put(
  '/areas/:id',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByAreaId(req.params.id)),
  asyncHandler(parkingController.updateArea),
);

router.delete(
  '/areas/:id',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByAreaId(req.params.id)),
  asyncHandler(parkingController.removeArea),
);

// ---- Parking slots ------------------------------------------------------

router.get('/slots', requireAuth, requirePermission('parking.read'), resolveSlotListAccess, asyncHandler(parkingController.listSlots));

router.get(
  '/slots/:id',
  requireAuth,
  requirePermission('parking.read'),
  requireBranchAccess(branchIdOfSlotArea),
  asyncHandler(parkingController.getSlot),
);

router.post(
  '/slots',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByAreaId(req.body.parking_area_id)),
  asyncHandler(parkingController.createSlot),
);

router.put(
  '/slots/:id',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess(branchIdOfSlotArea),
  asyncHandler(parkingController.updateSlot),
);

router.delete(
  '/slots/:id',
  requireAuth,
  requirePermission('parking.manage'),
  requireBranchAccess(branchIdOfSlotArea),
  asyncHandler(parkingController.removeSlot),
);

// ---- Parking ticket flow -----------------------------------------------

router.get('/tickets', requireAuth, requirePermission('parking.read'), resolveListAccess, asyncHandler(parkingController.listTickets));

router.get(
  '/tickets/:id',
  requireAuth,
  requirePermission('parking.read'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(parkingController.getTicket),
);

router.post(
  '/tickets',
  requireAuth,
  requirePermission('parking.operate'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(parkingController.enterVehicle),
);

router.post(
  '/tickets/:id/exit',
  requireAuth,
  requirePermission('parking.operate'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(parkingController.exitVehicle),
);

router.post(
  '/tickets/:id/payment',
  requireAuth,
  requirePermission('parking.operate'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(parkingController.payTicket),
);

router.post(
  '/tickets/:id/cancel',
  requireAuth,
  requirePermission('parking.operate'),
  requireBranchAccess((req) => parkingRepository.findBranchIdByTicketId(req.params.id)),
  asyncHandler(parkingController.cancelTicket),
);

module.exports = router;
