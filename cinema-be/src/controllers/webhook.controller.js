const crypto = require('crypto');
const webhookRepository = require('../repositories/webhook.repository');
const integrationRepository = require('../repositories/integration.repository');
const webhookService = require('../services/webhook.service');
const webhookSignature = require('../services/webhookSignature');
const Integration = require('../models/Integration');
const Webhook = require('../models/Webhook');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

function hashPayload(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

// POST /api/webhooks/:provider -> generic inbound webhook endpoint for any registered
// Integration. Public (no requireAuth): a third party can't hold our JWT, so authentication
// here is purely the provider's own signature scheme (see webhookSignature.verify).
async function receive(req, res) {
  const providerParam = String(req.params.provider || '').toUpperCase();
  const integration = await integrationRepository.findByProvider(providerParam);
  if (!integration || integration.status !== Integration.STATUSES.ACTIVE) {
    return res.status(404).json({ message: 'Unknown or inactive integration', code: 'INTEGRATION_NOT_FOUND' });
  }

  const secret = integration.secret_env_var ? process.env[integration.secret_env_var] : null;
  const { required, verified } = webhookSignature.verify({
    provider: providerParam,
    body: req.body,
    headers: req.headers,
    secret,
  });
  if (required && !verified) {
    return res.status(401).json({ message: 'Invalid signature', code: 'INVALID_SIGNATURE' });
  }

  const event = String(req.body?.event || req.body?.type || 'unknown');
  const externalId = req.body?.id ?? req.body?.eventId ?? req.body?.event_id ?? hashPayload(req.body);
  const configuredMaxAttempts = Number(integration.config?.maxAttempts);
  const maxAttempts = Number.isInteger(configuredMaxAttempts) && configuredMaxAttempts > 0 ? configuredMaxAttempts : undefined;

  try {
    const result = await webhookService.receiveWebhook({
      provider: providerParam,
      event,
      externalId,
      payload: req.body,
      integrationId: integration.id,
      signatureVerified: verified,
      ...(maxAttempts ? { maxAttempts } : {}),
    });
    res.json({ received: true, duplicate: !!result.duplicate, status: result.webhook?.status ?? null });
  } catch (err) {
    // The processor threw — already recorded FAILED with a retry scheduled (see
    // webhook.service.runProcessor). Ack receipt anyway: our own retry sweep owns recovery
    // from here, so the provider should not need to (and should not) hammer us with resends.
    res.json({ received: true, duplicate: false, status: Webhook.STATUS.FAILED });
  }
}

// GET /api/webhooks?provider=&status=&page=&limit= -> admin monitoring log
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.provider) filter.provider = String(req.query.provider).toUpperCase();
  if (req.query.status) filter.status = req.query.status;
  const { data, total } = await webhookRepository.list(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/webhooks/:id
async function getById(req, res) {
  const webhook = await webhookRepository.findById(req.params.id);
  if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
  res.json(webhook);
}

// POST /api/webhooks/:id/retry -> admin-triggered manual replay of a FAILED webhook
async function retry(req, res) {
  const webhook = await webhookRepository.findById(req.params.id);
  if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
  if (webhook.status !== Webhook.STATUS.FAILED) {
    return res.status(400).json({ message: 'Only a FAILED webhook can be retried', code: 'WEBHOOK_NOT_RETRYABLE' });
  }

  try {
    const result = await webhookService.retryWebhook(webhook);
    res.json(result.webhook);
  } catch (err) {
    res.json(err.webhook || (await webhookRepository.findById(req.params.id)));
  }
}

module.exports = { receive, list, getById, retry };
