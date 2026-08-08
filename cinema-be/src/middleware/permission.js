const roleRepository = require('../repositories/role.repository');
const rolePermissionRepository = require('../repositories/rolePermission.repository');
const branchRepository = require('../repositories/branch.repository');
const employeeRepository = require('../repositories/employee.repository');
const positionPermissionRepository = require('../repositories/positionPermission.repository');

function requirePermission(code) {
  return async (req, res, next) => {
    try {
      if (!req.account) return res.status(401).json({ message: 'Missing Authorization token' });

      const role = await roleRepository.findByLegacyNumber(req.account.role);
      if (!role) return res.status(403).json({ message: 'Forbidden' });

      let scope = await rolePermissionRepository.findScopeForRolePermission(role.id, code);

      if (!scope && role.code === 'EMPLOYEE') {
        const employee = await employeeRepository.findByAccountId(req.account.accountId);
        if (employee && employee.status === 1 && employee.position_id) {
          scope = await positionPermissionRepository.findScopeForPositionPermission(employee.position_id, code);
        }
      }

      if (!scope) return res.status(403).json({ message: 'Forbidden' });

      req.permissionScope = scope;
      req.roleCode = role.code;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Branch-scope gate: SUPER_ADMIN (ALL scope) bypasses; a Branch Admin must own the target
// branch, an Employee must be actively staffed there. Enforces "cannot access/modify/view
// another branch's data" for BRANCH-scoped roles.
function requireBranchAccess(resolveBranchId) {
  return async (req, res, next) => {
    try {
      const branchId = await resolveBranchId(req);
      if (branchId === null || branchId === undefined || Number.isNaN(branchId)) {
        return res.status(404).json({ message: 'Branch not found' });
      }

      if (req.permissionScope === 'ALL') {
        req.branchId = branchId;
        return next();
      }

      const branch = await branchRepository.findById(branchId);
      if (!branch) return res.status(404).json({ message: 'Branch not found' });

      if (branch.owner_id === req.account.accountId) {
        req.branchId = branchId;
        req.branch = branch;
        return next();
      }

      const employee = await employeeRepository.findActiveByAccountAndBranch(req.account.accountId, branchId);
      if (employee) {
        req.branchId = branchId;
        req.branch = branch;
        req.employee = employee;
        return next();
      }

      return res.status(403).json({ message: 'Forbidden' });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireBranchAccess };
