const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const companyController = require('../controllers/company.controller');

const router = express.Router();

// GET /api/company (company.read permission — super admin only)
router.get('/', requireAuth, requirePermission('company.read'), asyncHandler(companyController.list));

// GET /api/company/:id (company.read permission — super admin only)
router.get('/:id', requireAuth, requirePermission('company.read'), asyncHandler(companyController.getById));

// POST /api/company { name, code, address, phone, email } (company.create permission — super admin only)
router.post('/', requireAuth, requirePermission('company.create'), asyncHandler(companyController.create));

// PUT /api/company/:id { name, address, phone, email, status } (company.update permission — super admin only)
router.put('/:id', requireAuth, requirePermission('company.update'), asyncHandler(companyController.update));

// DELETE /api/company/:id (company.delete permission — super admin only)
router.delete('/:id', requireAuth, requirePermission('company.delete'), asyncHandler(companyController.remove));

module.exports = router;
