const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const supplierController = require('../controllers/supplier.controller');

const router = express.Router();

// The supplier catalogue is company-wide. SUPER_ADMIN maintains it (supplier.manage); a Branch
// Admin only reads it (supplier.read) to pick a supplier on a Purchase Order. No Employee Position
// holds either permission.
router.get('/all', requireAuth, requirePermission('supplier.read'), asyncHandler(supplierController.all));
router.get('/', requireAuth, requirePermission('supplier.read'), asyncHandler(supplierController.list));
router.get('/:id', requireAuth, requirePermission('supplier.read'), asyncHandler(supplierController.getById));

router.post('/', requireAuth, requirePermission('supplier.manage'), asyncHandler(supplierController.create));
router.put('/:id', requireAuth, requirePermission('supplier.manage'), asyncHandler(supplierController.update));
router.delete('/:id', requireAuth, requirePermission('supplier.manage'), asyncHandler(supplierController.remove));

module.exports = router;
