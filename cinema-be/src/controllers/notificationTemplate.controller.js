const NotificationTemplate = require('../models/NotificationTemplate');
const templateRepository = require('../repositories/notificationTemplate.repository');
const templateService = require('../services/notificationTemplate.service');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// Ticket 26 — admin CRUD for notification templates, plus a no-save preview endpoint for the
// editor. Every write goes through templateService.validate; a validation failure is answered
// as 400 with a per-field `details` array, a duplicate (event+channel+language) as 409.

function sendValidationError(res, err) {
  return res.status(400).json({ message: err.message, code: 'TEMPLATE_INVALID', details: err.details });
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

// GET /api/notification-templates?event=&channel=&language=&status=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await templateRepository.findFiltered(
    {
      event: req.query.event,
      channel: req.query.channel,
      language: req.query.language,
      status: req.query.status,
    },
    { skip, limit },
  );
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/notification-templates/meta — vocabulary for the editor's dropdowns + variable hints.
async function meta(_req, res) {
  res.json({
    events: Object.values(NotificationTemplate.EVENT),
    channels: Object.values(NotificationTemplate.CHANNEL),
    supportedChannels: NotificationTemplate.SUPPORTED_CHANNELS,
    languages: NotificationTemplate.SUPPORTED_LANGUAGES,
    defaultLanguage: NotificationTemplate.DEFAULT_LANGUAGE,
    statuses: Object.values(NotificationTemplate.STATUS),
    variablesByEvent: NotificationTemplate.VARIABLES_BY_EVENT,
    sampleVariables: templateService.SAMPLE_VARIABLES,
  });
}

// GET /api/notification-templates/:id
async function getById(req, res) {
  const template = await templateRepository.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Notification template not found' });
  res.json(template);
}

// POST /api/notification-templates { event, channel, subject?, content, language?, status?, description? }
async function create(req, res) {
  let cleaned;
  try {
    cleaned = templateService.validate(req.body);
  } catch (err) {
    if (err instanceof templateService.TemplateValidationError) return sendValidationError(res, err);
    throw err;
  }

  try {
    const created = await templateRepository.create({
      ...cleaned,
      description: req.body.description ? String(req.body.description) : '',
      updated_by: req.account.accountId,
    });
    res.status(201).json(created);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({
        message: 'A template for this event + channel + language already exists',
        code: 'DUPLICATE_TEMPLATE',
      });
    }
    throw err;
  }
}

// PUT /api/notification-templates/:id — patch: any subset of the editable fields. The merged
// result is re-validated as a whole so a patch can't leave the row in an invalid state.
async function update(req, res) {
  const existing = await templateRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Notification template not found' });

  const merged = {
    event: req.body.event ?? existing.event,
    channel: req.body.channel ?? existing.channel,
    subject: req.body.subject ?? existing.subject,
    content: req.body.content ?? existing.content,
    language: req.body.language ?? existing.language,
    status: req.body.status ?? existing.status,
  };

  let cleaned;
  try {
    cleaned = templateService.validate(merged);
  } catch (err) {
    if (err instanceof templateService.TemplateValidationError) return sendValidationError(res, err);
    throw err;
  }

  try {
    const updated = await templateRepository.updateById(req.params.id, {
      ...cleaned,
      description: req.body.description ?? existing.description,
      updated_by: req.account.accountId,
    });
    res.json(updated);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({
        message: 'A template for this event + channel + language already exists',
        code: 'DUPLICATE_TEMPLATE',
      });
    }
    throw err;
  }
}

// DELETE /api/notification-templates/:id
async function remove(req, res) {
  const deleted = await templateRepository.deleteById(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Notification template not found' });
  res.json({ message: 'Deleted' });
}

// POST /api/notification-templates/preview        { subject?, content, variables? }
// POST /api/notification-templates/:id/preview    { variables? }   (uses the stored template)
// Renders against sample data (plus any caller-supplied overrides). No persistence.
async function preview(req, res) {
  let { subject, content } = req.body;
  const id = req.params.id ?? req.body.id;

  if (id !== undefined && id !== null && id !== '') {
    const template = await templateRepository.findById(id);
    if (!template) return res.status(404).json({ message: 'Notification template not found' });
    subject = template.subject;
    content = template.content;
  }

  if (content == null || String(content).trim() === '') {
    return res.status(400).json({ message: 'content is required for a preview', code: 'TEMPLATE_INVALID' });
  }

  res.json(templateService.renderPreview({ subject, content, variables: req.body.variables }));
}

module.exports = { list, meta, getById, create, update, remove, preview };
