const SystemConfig = require('../models/SystemConfig');
const nextId = require('../utils/nextId');


function normalizeBranchId(branchId) {
  return branchId === undefined || branchId === null ? null : Number(branchId);
}

async function findOne(key, branchId) {
  return SystemConfig.findOne({ key, branch_id: normalizeBranchId(branchId) });
}

async function findForResolution(key, branchId) {
  const ids = branchId === undefined || branchId === null ? [null] : [null, Number(branchId)];
  return SystemConfig.find({ key, branch_id: { $in: ids } });
}

async function findAllForBranch(branchId) {
  const ids = branchId === undefined || branchId === null ? [null] : [null, Number(branchId)];
  return SystemConfig.find({ branch_id: { $in: ids } });
}

async function findAll(filter = {}) {
  return SystemConfig.find(filter).sort({ key: 1, branch_id: 1 });
}

async function upsert({ key, branchId, value, accountId }) {
  const normalizedBranchId = normalizeBranchId(branchId);
  const existing = await SystemConfig.findOne({ key, branch_id: normalizedBranchId });
  if (existing) {
    existing.value = value;
    existing.updated_by = accountId ?? null;
    await existing.save();
    return existing;
  }
  const id = await nextId('systemConfig');
  return SystemConfig.create({
    id,
    key,
    branch_id: normalizedBranchId,
    value,
    updated_by: accountId ?? null,
  });
}

async function remove(key, branchId) {
  return SystemConfig.findOneAndDelete({ key, branch_id: normalizeBranchId(branchId) });
}

module.exports = { findOne, findForResolution, findAllForBranch, findAll, upsert, remove };
