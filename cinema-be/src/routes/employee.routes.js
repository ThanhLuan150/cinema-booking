const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireCinemaAccess } = require('../middleware/permission');
const employeeRepository = require('../repositories/employee.repository');
const employeeController = require('../controllers/employee.controller');

const router = express.Router();

// GET /api/employee?cinemaId= (employee.read permission, cinema-scoped)
router.get(
  '/',
  requireAuth,
  requirePermission('employee.read'),
  requireCinemaAccess((req) => Number(req.query.cinemaId)),
  asyncHandler(employeeController.list),
);

// POST /api/employee { email, password, name, phone, cinema_id, position } (employee.create permission, cinema-scoped)
router.post(
  '/',
  requireAuth,
  requirePermission('employee.create'),
  requireCinemaAccess((req) => Number(req.body.cinema_id)),
  asyncHandler(employeeController.create),
);

// PUT /api/employee/:id { position, status } (employee.update permission, cinema-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('employee.update'),
  requireCinemaAccess((req) => employeeRepository.findCinemaIdByEmployeeId(req.params.id)),
  asyncHandler(employeeController.update),
);

// DELETE /api/employee/:id (employee.delete permission, cinema-scoped) — deactivates the employee
router.delete(
  '/:id',
  requireAuth,
  requirePermission('employee.delete'),
  requireCinemaAccess((req) => employeeRepository.findCinemaIdByEmployeeId(req.params.id)),
  asyncHandler(employeeController.remove),
);

// POST /api/employee/:id/reset-password (employee.update permission, cinema-scoped) — emails the
router.post(
  '/:id/reset-password',
  requireAuth,
  requirePermission('employee.update'),
  requireCinemaAccess((req) => employeeRepository.findCinemaIdByEmployeeId(req.params.id)),
  asyncHandler(employeeController.resetPassword),
);

module.exports = router;
