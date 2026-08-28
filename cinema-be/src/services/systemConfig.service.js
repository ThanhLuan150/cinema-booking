const registry = require('../config/settingsRegistry');
const systemConfigRepository = require('../repositories/systemConfig.repository');

const CACHE_TTL_MS = Number(process.env.SYSTEM_CONFIG_CACHE_TTL_MS) || 30_000;
const cache = new Map();

function cacheKey(key, branchId) {
  return `${key}:${branchId === null || branchId === undefined ? 'GLOBAL' : Number(branchId)}`;
}

function invalidate(key, branchId) {
  cache.delete(cacheKey(key, branchId));
}

function invalidateAll() {
  cache.clear();
}

async function getEffective(key, branchId = null) {
  const meta = registry.meta(key);
  if (!meta) {
    throw new registry.SettingValidationError([{ field: 'key', message: `Unknown setting key: ${key}` }]);
  }

  const normalizedBranchId = branchId === undefined || branchId === null ? null : Number(branchId);
  const ck = cacheKey(key, normalizedBranchId);
  const cached = cache.get(ck);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const rows = await systemConfigRepository.findForResolution(key, normalizedBranchId);
  const branchDoc =
    normalizedBranchId !== null && meta.branchOverridable
      ? rows.find((row) => row.branch_id === normalizedBranchId)
      : null;
  const globalDoc = rows.find((row) => row.branch_id === null);

  let value = meta.default;
  let source = 'DEFAULT';
  let id = null;
  if (branchDoc) {
    value = branchDoc.value;
    source = 'BRANCH';
    id = branchDoc.id;
  } else if (globalDoc) {
    value = globalDoc.value;
    source = 'GLOBAL';
    id = globalDoc.id;
  }

  const data = { ...meta, branchId: normalizedBranchId, value, source, id };
  cache.set(ck, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// The common case for business logic elsewhere in the app: just the resolved value.
async function getValue(key, branchId = null) {
  const { value } = await getEffective(key, branchId);
  return value;
}

// Every registered setting, resolved for one branch context — the admin list view.
async function getAllEffective(branchId = null) {
  return Promise.all(registry.KEYS.map((key) => getEffective(key, branchId)));
}

// Validates + stores an override. `branchId: null` writes the Global Setting. Throws
// registry.SettingValidationError (bad type/range) — the caller is expected to have already
// checked RBAC scope/branch ownership before calling this.
async function setValue({ key, branchId = null, value, accountId }) {
  const meta = registry.meta(key);
  if (!meta) {
    throw new registry.SettingValidationError([{ field: 'key', message: `Unknown setting key: ${key}` }]);
  }
  const normalizedBranchId = branchId === undefined || branchId === null ? null : Number(branchId);
  if (normalizedBranchId !== null && !meta.branchOverridable) {
    throw new registry.SettingValidationError([
      { field: 'branchId', code: 'NOT_BRANCH_OVERRIDABLE', message: `${key} can only be configured globally` },
    ]);
  }

  const normalizedValue = registry.validateValue(key, value);
  await systemConfigRepository.upsert({ key, branchId: normalizedBranchId, value: normalizedValue, accountId });
  invalidate(key, normalizedBranchId);
  return getEffective(key, normalizedBranchId);
}

// Removes an override, reverting that (key, branch) to whatever the next level down resolves
// to. Idempotent: resetting a key with no override at that level is a no-op, not an error.
async function resetValue({ key, branchId = null }) {
  const meta = registry.meta(key);
  if (!meta) {
    throw new registry.SettingValidationError([{ field: 'key', message: `Unknown setting key: ${key}` }]);
  }
  const normalizedBranchId = branchId === undefined || branchId === null ? null : Number(branchId);
  await systemConfigRepository.remove(key, normalizedBranchId);
  invalidate(key, normalizedBranchId);
  return getEffective(key, normalizedBranchId);
}

module.exports = {
  getEffective,
  getValue,
  getAllEffective,
  setValue,
  resetValue,
  invalidateAll,
  SettingValidationError: registry.SettingValidationError,
};
