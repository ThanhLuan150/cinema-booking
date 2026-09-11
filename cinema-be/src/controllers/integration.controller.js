const integrationRepository = require('../repositories/integration.repository');
const Integration = require('../models/Integration');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const PROVIDER_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push('name is required');
  }
  if (!partial || body.provider !== undefined) {
    const provider = String(body.provider || '').toUpperCase().trim();
    if (!PROVIDER_RE.test(provider)) errors.push('provider must be 2-32 chars, letters/digits/_/- only');
  }
  if (!partial || body.type !== undefined) {
    if (!Object.values(Integration.TYPES).includes(body.type)) {
      errors.push(`type must be one of: ${Object.values(Integration.TYPES).join(', ')}`);
    }
  }
  if (body.status !== undefined && !Object.values(Integration.STATUSES).includes(body.status)) {
    errors.push(`status must be one of: ${Object.values(Integration.STATUSES).join(', ')}`);
  }
  return errors;
}

// GET /api/integrations?type=&status=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;
  const { data, total } = await integrationRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/integrations/all -> unpaginated, for pickers
async function all(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  res.json(await integrationRepository.findAll(filter));
}

// GET /api/integrations/:id
async function getById(req, res) {
  const integration = await integrationRepository.findById(req.params.id);
  if (!integration) return res.status(404).json({ message: 'Integration not found' });
  res.json(integration);
}

// POST /api/integrations
async function create(req, res) {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join('; ') });

  const provider = String(req.body.provider).toUpperCase().trim();
  if (await integrationRepository.findByProvider(provider)) {
    return res.status(409).json({ message: 'An integration for this provider already exists', code: 'PROVIDER_TAKEN' });
  }

  const id = await nextId('integration');
  try {
    const integration = await integrationRepository.create({
      id,
      name: String(req.body.name).trim(),
      provider,
      type: req.body.type,
      status: req.body.status || Integration.STATUSES.ACTIVE,
      config: req.body.config && typeof req.body.config === 'object' ? req.body.config : {},
      secret_env_var: req.body.secret_env_var ? String(req.body.secret_env_var).trim() : null,
      description: req.body.description ? String(req.body.description).trim() : '',
    });
    res.status(201).json(integration);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An integration for this provider already exists', code: 'PROVIDER_TAKEN' });
    }
    throw err;
  }
}

// PUT /api/integrations/:id
async function update(req, res) {
  const integration = await integrationRepository.findById(req.params.id);
  if (!integration) return res.status(404).json({ message: 'Integration not found' });

  const errors = validatePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors.join('; ') });

  const updates = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.provider !== undefined) {
    const provider = String(req.body.provider).toUpperCase().trim();
    if (provider !== integration.provider) {
      const clash = await integrationRepository.findByProvider(provider);
      if (clash && clash.id !== integration.id) {
        return res.status(409).json({ message: 'An integration for this provider already exists', code: 'PROVIDER_TAKEN' });
      }
    }
    updates.provider = provider;
  }
  if (req.body.type !== undefined) updates.type = req.body.type;
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.config !== undefined && typeof req.body.config === 'object') updates.config = req.body.config;
  if (req.body.secret_env_var !== undefined) {
    updates.secret_env_var = req.body.secret_env_var ? String(req.body.secret_env_var).trim() : null;
  }
  if (req.body.description !== undefined) updates.description = String(req.body.description).trim();

  try {
    const updated = await integrationRepository.updateFields(integration.id, updates);
    res.json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An integration for this provider already exists', code: 'PROVIDER_TAKEN' });
    }
    throw err;
  }
}

// DELETE /api/integrations/:id
async function remove(req, res) {
  const integration = await integrationRepository.findById(req.params.id);
  if (!integration) return res.status(404).json({ message: 'Integration not found' });
  await integrationRepository.remove(integration.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, all, getById, create, update, remove };
