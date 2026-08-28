const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const registry = require('../config/settingsRegistry');
const systemConfigService = require('../services/systemConfig.service');
const { recordAudit } = require('../services/auditLog.service');

function parseBranchId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

async function assertBranchOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (branchId === null) return false; // BRANCH scope can never manage the Global Setting
  const branch = await Branch.findOne({ id: branchId });
  return Boolean(branch && branch.owner_id === req.account.accountId);
}

function sendValidationError(res, err) {
  return res.status(400).json({ message: err.message, code: 'SETTING_INVALID', details: err.details });
}

// GET /api/system-config/meta — the registry itself (types/defaults/units/bounds), for the
// admin form to render without hardcoding setting shapes on the frontend either.
async function meta(_req, res) {
  res.json({ settings: registry.listMeta() });
}

// GET /api/system-config?branchId= -> every setting resolved for that context.
// - ALL scope + no branchId: the Global Settings view.
// - ALL scope + branchId: that branch's effective settings (branch override -> global -> default).
// - BRANCH scope: branchId is required and must be a branch this admin owns.
async function list(req, res) {
  const branchId = parseBranchId(req.query.branchId);
  if (branchId === undefined) return res.status(400).json({ message: 'branchId must be a number' });

  if (req.permissionScope === 'BRANCH') {
    if (branchId === null) {
      return res.status(400).json({ message: 'branchId is required', code: 'BRANCH_ID_REQUIRED' });
    }
    if (!(await assertBranchOwnership(req, branchId))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const settings = await systemConfigService.getAllEffective(branchId);
  res.json({ branchId, settings });
}

// GET /api/system-config/:key?branchId=
async function getByKey(req, res) {
  const { key } = req.params;
  if (!registry.SETTINGS[key]) return res.status(404).json({ message: 'Setting not found' });

  const branchId = parseBranchId(req.query.branchId);
  if (branchId === undefined) return res.status(400).json({ message: 'branchId must be a number' });

  if (req.permissionScope === 'BRANCH') {
    if (branchId === null) {
      return res.status(400).json({ message: 'branchId is required', code: 'BRANCH_ID_REQUIRED' });
    }
    if (!(await assertBranchOwnership(req, branchId))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  res.json(await systemConfigService.getEffective(key, branchId));
}

// PUT /api/system-config/:key { value, branchId? } — upsert an override.
async function update(req, res) {
  const { key } = req.params;
  if (!registry.SETTINGS[key]) return res.status(404).json({ message: 'Setting not found' });
  if (!Object.prototype.hasOwnProperty.call(req.body, 'value')) {
    return res.status(400).json({ message: 'value is required' });
  }

  const branchId = parseBranchId(req.body.branchId);
  if (branchId === undefined) return res.status(400).json({ message: 'branchId must be a number' });

  if (branchId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only a super admin can manage Global Settings' });
  }
  if (branchId !== null && !(await assertBranchOwnership(req, branchId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let effective;
  try {
    effective = await systemConfigService.setValue({
      key,
      branchId,
      value: req.body.value,
      accountId: req.account.accountId,
    });
  } catch (err) {
    if (err instanceof systemConfigService.SettingValidationError) return sendValidationError(res, err);
    throw err;
  }

  await recordAudit({
    req,
    action: AuditLog.ACTION.UPDATE_SYSTEM_CONFIG,
    entityType: AuditLog.ENTITY_TYPE.SYSTEM_CONFIG,
    entityId: effective.id,
    branchId,
    metadata: { key, value: effective.value },
  });

  res.json(effective);
}

// DELETE /api/system-config/:key?branchId= — reset: removes the override at this level so the
// key falls back to the next level down (branch -> global -> default). Idempotent.
async function reset(req, res) {
  const { key } = req.params;
  if (!registry.SETTINGS[key]) return res.status(404).json({ message: 'Setting not found' });

  const branchId = parseBranchId(req.query.branchId);
  if (branchId === undefined) return res.status(400).json({ message: 'branchId must be a number' });

  if (branchId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only a super admin can manage Global Settings' });
  }
  if (branchId !== null && !(await assertBranchOwnership(req, branchId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const effective = await systemConfigService.resetValue({ key, branchId });

  await recordAudit({
    req,
    action: AuditLog.ACTION.RESET_SYSTEM_CONFIG,
    entityType: AuditLog.ENTITY_TYPE.SYSTEM_CONFIG,
    entityId: effective.id ?? 0,
    branchId,
    metadata: { key },
  });

  res.json(effective);
}

module.exports = { meta, list, getByKey, update, reset };
