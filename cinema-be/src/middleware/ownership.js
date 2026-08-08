const branchRepository = require('../repositories/branch.repository');

// Stricter branch-scope gate than requireBranchAccess: SUPER_ADMIN (ALL scope) bypasses,
// otherwise the caller must be the branch's assigned owner (Branch Admin) — an Employee
// merely staffed there is not enough. Enforces "cannot modify/change scope of another branch".
function requireBranchOwnership(resolveBranchId) {
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
      if (branch.owner_id !== req.account.accountId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.branchId = branchId;
      req.branch = branch;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireBranchOwnership };
