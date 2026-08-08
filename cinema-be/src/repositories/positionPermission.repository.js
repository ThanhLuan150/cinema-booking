const PositionPermission = require('../models/PositionPermission');
const Permission = require('../models/Permission');

async function findScopeForPositionPermission(positionId, permissionCode) {
  const permission = await Permission.findOne({ code: permissionCode });
  if (!permission) return null;
  const link = await PositionPermission.findOne({ position_id: Number(positionId), permission_id: permission.id });
  return link ? link.scope : null;
}

async function findPermissionCodesForPosition(positionId) {
  const links = await PositionPermission.find({ position_id: Number(positionId) });
  const permissionIds = links.map((link) => link.permission_id);
  const permissions = await Permission.find({ id: { $in: permissionIds } });
  return permissions.map((permission) => permission.code);
}

async function create({ id, position_id, permission_id, scope }) {
  return PositionPermission.create({ id, position_id, permission_id, scope });
}

module.exports = { findScopeForPositionPermission, findPermissionCodesForPosition, create };
