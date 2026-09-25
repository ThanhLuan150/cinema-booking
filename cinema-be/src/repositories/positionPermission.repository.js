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

// Grants (permission code + scope) for a set of positions in two queries, keyed by position id —
// used to show an admin what each Position allows without an N+1 lookup.
async function findGrantsByPositionIds(positionIds) {
  const links = await PositionPermission.find({ position_id: { $in: positionIds.map(Number) } });
  const permissions = await Permission.find({ id: { $in: links.map((link) => link.permission_id) } });
  const codeById = new Map(permissions.map((permission) => [permission.id, permission.code]));
  const grantsByPosition = new Map(positionIds.map((id) => [Number(id), []]));
  for (const link of links) {
    const code = codeById.get(link.permission_id);
    if (code) grantsByPosition.get(link.position_id).push({ code, scope: link.scope });
  }
  for (const grants of grantsByPosition.values()) grants.sort((a, b) => a.code.localeCompare(b.code));
  return grantsByPosition;
}

async function create({ id, position_id, permission_id, scope }) {
  return PositionPermission.create({ id, position_id, permission_id, scope });
}

module.exports = {
  findScopeForPositionPermission,
  findPermissionCodesForPosition,
  findGrantsByPositionIds,
  create,
};
