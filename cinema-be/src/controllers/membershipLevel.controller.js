const MembershipLevel = require('../models/MembershipLevel');
const Account = require('../models/Account');
const nextId = require('../utils/nextId');

// GET /api/membership-levels -> every tier (including inactive), ascending by threshold.
// Readable by any authenticated user (customer-facing tier/benefits comparison).
async function list(req, res) {
  const levels = await MembershipLevel.find().sort({ min_points: 1 });
  res.json(levels);
}

// POST /api/membership-levels { code, name, min_points, active } (admin only)
async function create(req, res) {
  const { code, name, min_points, active } = req.body || {};
  if (!code || !name || min_points === undefined) {
    return res.status(400).json({ message: 'code, name and min_points are required' });
  }

  const normalizedCode = String(code).toUpperCase();
  if (!Account.MEMBERSHIP_LEVELS.includes(normalizedCode)) {
    return res.status(400).json({
      message: `code must be one of ${Account.MEMBERSHIP_LEVELS.join(', ')} (the tier codes Account.membership_level accepts)`,
    });
  }
  if (!(Number(min_points) >= 0)) return res.status(400).json({ message: 'min_points must be >= 0' });

  const existing = await MembershipLevel.findOne({ code: normalizedCode });
  if (existing) {
    return res.status(409).json({ message: 'A level with this code already exists', code: 'LEVEL_CODE_EXISTS' });
  }

  const level = await MembershipLevel.create({
    id: await nextId('membershipLevel'),
    code: normalizedCode,
    name,
    min_points: Number(min_points),
    active: active === undefined ? true : Boolean(active),
  });
  res.status(201).json(level);
}

// PUT /api/membership-levels/:id { name, min_points, active } (admin only) — code is
// immutable once created since Account.membership_level values reference it directly.
async function update(req, res) {
  const level = await MembershipLevel.findOne({ id: Number(req.params.id) });
  if (!level) return res.status(404).json({ message: 'Level not found' });

  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.min_points !== undefined) {
    if (!(Number(req.body.min_points) >= 0)) return res.status(400).json({ message: 'min_points must be >= 0' });
    updates.min_points = Number(req.body.min_points);
  }
  if (req.body.active !== undefined) updates.active = Boolean(req.body.active);

  const updated = await MembershipLevel.findOneAndUpdate({ id: level.id }, { $set: updates }, { new: true });
  res.json(updated);
}

// DELETE /api/membership-levels/:id (admin only)
async function remove(req, res) {
  const level = await MembershipLevel.findOne({ id: Number(req.params.id) });
  if (!level) return res.status(404).json({ message: 'Level not found' });

  await MembershipLevel.deleteOne({ id: level.id });
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
