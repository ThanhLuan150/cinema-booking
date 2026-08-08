const roleRepository = require('../repositories/role.repository');
const rolePermissionRepository = require('../repositories/rolePermission.repository');
const cinemaRepository = require('../repositories/cinema.repository');
const employeeRepository = require('../repositories/employee.repository');

// Gate a route by permission code (e.g. 'employee.create'), resolved via the
// Role/Permission/RolePermission tables instead of a hardcoded role number list.
function requirePermission(code) {
  return async (req, res, next) => {
    try {
      if (!req.account) return res.status(401).json({ message: 'Missing Authorization token' });

      const role = await roleRepository.findByLegacyNumber(req.account.role);
      if (!role) return res.status(403).json({ message: 'Forbidden' });

      const allowed = await rolePermissionRepository.roleHasPermission(role.id, code);
      if (!allowed) return res.status(403).json({ message: 'Forbidden' });

      next();
    } catch (err) {
      next(err);
    }
  };
}

// Generalizes requireCinemaOwnership: super admin bypasses, branch admin (role 2)
// must own the cinema, employee (role 3) must be an active staff member of it.
function requireCinemaAccess(resolveCinemaId) {
  return async (req, res, next) => {
    try {
      const cinemaId = await resolveCinemaId(req);
      if (cinemaId === null || cinemaId === undefined || Number.isNaN(cinemaId)) {
        return res.status(404).json({ message: 'Cinema not found' });
      }

      if (req.account.role === 0) {
        req.cinemaId = cinemaId;
        return next();
      }

      const cinema = await cinemaRepository.findById(cinemaId);
      if (!cinema) return res.status(404).json({ message: 'Cinema not found' });

      if (req.account.role === 2) {
        if (cinema.owner_id !== req.account.accountId) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        req.cinemaId = cinemaId;
        req.cinema = cinema;
        return next();
      }

      if (req.account.role === 3) {
        const employee = await employeeRepository.findActiveByAccountAndCinema(
          req.account.accountId,
          cinemaId,
        );
        if (!employee) return res.status(403).json({ message: 'Forbidden' });
        req.cinemaId = cinemaId;
        req.cinema = cinema;
        req.employee = employee;
        return next();
      }

      return res.status(403).json({ message: 'Forbidden' });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireCinemaAccess };
