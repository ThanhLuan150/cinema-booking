const roleRepository = require('../repositories/role.repository');
const rolePermissionRepository = require('../repositories/rolePermission.repository');
const cinemaRepository = require('../repositories/cinema.repository');
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
function requireCinemaAccess(resolveCinemaId) {
  return async (req, res, next) => {
    try {
      const cinemaId = await resolveCinemaId(req);
      if (cinemaId === null || cinemaId === undefined || Number.isNaN(cinemaId)) {
        return res.status(404).json({ message: 'Cinema not found' });
      }

      if (req.permissionScope === 'ALL') {
        req.cinemaId = cinemaId;
        return next();
      }

      const cinema = await cinemaRepository.findById(cinemaId);
      if (!cinema) return res.status(404).json({ message: 'Cinema not found' });

      if (cinema.owner_id === req.account.accountId) {
        req.cinemaId = cinemaId;
        req.cinema = cinema;
        return next();
      }

      const employee = await employeeRepository.findActiveByAccountAndCinema(req.account.accountId, cinemaId);
      if (employee) {
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
