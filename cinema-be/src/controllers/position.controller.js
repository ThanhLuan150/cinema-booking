const positionRepository = require('../repositories/position.repository');
const positionPermissionRepository = require('../repositories/positionPermission.repository');

// GET /api/position[?withPermissions=true] -> active positions. With withPermissions each
// position also carries the permission codes (and scopes) it grants, read-only, so a Branch Admin
// can see what they are handing out before assigning a Position. Permissions themselves are
// never editable through the API — they are seeded (seedPositions.js).
async function list(req, res) {
  const positions = await positionRepository.findAll({ activeOnly: true });
  if (req.query.withPermissions !== 'true') return res.json(positions);

  const grants = await positionPermissionRepository.findGrantsByPositionIds(positions.map((p) => p.id));
  res.json(positions.map((position) => ({ ...position.toJSON(), permissions: grants.get(position.id) ?? [] })));
}

module.exports = { list };
