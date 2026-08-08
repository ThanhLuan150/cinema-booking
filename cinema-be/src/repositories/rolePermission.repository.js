const RolePermission = require('../models/RolePermission');
const Permission = require('../models/Permission');

async function roleHasPermission(roleId, permissionCode) {
  const permission = await Permission.findOne({ code: permissionCode });
  if (!permission) return false;
  const link = await RolePermission.findOne({ role_id: Number(roleId), permission_id: permission.id });
  return Boolean(link);
}

async function findPermissionCodesForRole(roleId) {
  const links = await RolePermission.find({ role_id: Number(roleId) });
  const permissionIds = links.map((link) => link.permission_id);
  const permissions = await Permission.find({ id: { $in: permissionIds } });
  return permissions.map((permission) => permission.code);
}

async function create({ id, role_id, permission_id }) {
  return RolePermission.create({ id, role_id, permission_id });
}

module.exports = { roleHasPermission, findPermissionCodesForRole, create };
