const roleRepository = require('../repositories/role.repository');
const rolePermissionRepository = require('../repositories/rolePermission.repository');
const employeeRepository = require('../repositories/employee.repository');
const positionRepository = require('../repositories/position.repository');
const positionPermissionRepository = require('../repositories/positionPermission.repository');

async function resolvePermissionCodes({ accountId, role }) {
  const roleDoc = await roleRepository.findByLegacyNumber(role);
  if (!roleDoc) return null;

  const codes = new Set(await rolePermissionRepository.findPermissionCodesForRole(roleDoc.id));

  let positionCode = null;
  if (roleDoc.code === 'EMPLOYEE') {
    const employee = await employeeRepository.findByAccountId(accountId);
    if (employee && employee.status === 1 && employee.position_id) {
      const position = await positionRepository.findById(employee.position_id);
      if (position) {
        positionCode = position.code;
        for (const code of await positionPermissionRepository.findPermissionCodesForPosition(position.id)) {
          codes.add(code);
        }
      }
    }
  }

  return { roleCode: roleDoc.code, positionCode, codes };
}

module.exports = { resolvePermissionCodes };
