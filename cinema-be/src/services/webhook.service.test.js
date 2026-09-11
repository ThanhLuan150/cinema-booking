const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Webhook = require('../models/Webhook');
const webhookRepository = require('../repositories/webhook.repository');
const webhookService = require('./webhook.service');

beforeAll(async () => {
  await connect();
  await Webhook.init();
});
afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});
afterAll(async () => closeDatabase());

describe('webhookService.sanitizePayload', () => {
  it('redacts credential-shaped keys at any depth, leaving everything else intact', () => {
    const sanitized = webhookService.sanitizePayload({
      orderId: 'ORDER-1',
      password: 'p@ss',
      nested: { apiKey: 'sk_live_123', card_number: '4111111111111111', ok: 'fine' },
      list: [{ token: 'abc' }, { amount: 1000 }],
    });
    expect(sanitized).toEqual({
      orderId: 'ORDER-1',
      password: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', card_number: '[REDACTED]', ok: 'fine' },
      list: [{ token: '[REDACTED]' }, { amount: 1000 }],
    });
  });
});

describe('webhookService.receiveWebhook', () => {
  afterEach(() => {
    // Processors registered by a test must not leak into the next one.
    webhookService.registerProcessor('TESTPROVIDER', undefined);
  });

  it('runs the default (no-op success) processor when none is registered for the provider', async () => {
    const result = await webhookService.receiveWebhook({
      provider: 'UNREGISTERED',
      event: 'delivered',
      externalId: 'evt-1',
      payload: { ok: true },
    });
    expect(result.success).toBe(true);
    expect(result.webhook.status).toBe('SUCCESS');
  });

  it('does not process a duplicate event: a second call with the same external_id short-circuits', async () => {
    const handler = jest.fn().mockResolvedValue('done');
    webhookService.registerProcessor('TESTPROVIDER', handler);

    const first = await webhookService.receiveWebhook({
      provider: 'TESTPROVIDER',
      event: 'e',
      externalId: 'evt-dup',
      payload: {},
    });
    expect(first.duplicate).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);

    const second = await webhookService.receiveWebhook({
      provider: 'TESTPROVIDER',
      event: 'e',
      externalId: 'evt-dup',
      payload: {},
    });
    expect(second.duplicate).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1); // never re-invoked
  });

  it('two concurrent deliveries of the same event: exactly one runs the processor', async () => {
    const handler = jest.fn().mockResolvedValue('done');
    webhookService.registerProcessor('TESTPROVIDER', handler);

    await Promise.all([
      webhookService.receiveWebhook({ provider: 'TESTPROVIDER', event: 'e', externalId: 'evt-race', payload: {} }),
      webhookService.receiveWebhook({ provider: 'TESTPROVIDER', event: 'e', externalId: 'evt-race', payload: {} }),
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await Webhook.countDocuments({ provider: 'TESTPROVIDER', external_id: 'evt-race' })).toBe(1);
  });

  it('marks FAILED with a scheduled retry and rethrows when the processor throws', async () => {
    webhookService.registerProcessor('TESTPROVIDER', () => {
      throw new Error('boom');
    });

    await expect(
      webhookService.receiveWebhook({ provider: 'TESTPROVIDER', event: 'e', externalId: 'evt-fail', payload: {} }),
    ).rejects.toThrow('boom');

    const row = await Webhook.findOne({ provider: 'TESTPROVIDER', external_id: 'evt-fail' });
    expect(row.status).toBe('FAILED');
    expect(row.last_error).toBe('boom');
    expect(row.next_attempt_at).toBeInstanceOf(Date);
  });

  it('stops scheduling retries once max_attempts is exhausted', async () => {
    webhookService.registerProcessor('TESTPROVIDER', () => {
      throw new Error('boom');
    });
    await expect(
      webhookService.receiveWebhook({
        provider: 'TESTPROVIDER',
        event: 'e',
        externalId: 'evt-exhausted',
        payload: {},
        maxAttempts: 1,
      }),
    ).rejects.toThrow('boom');

    const row = await Webhook.findOne({ provider: 'TESTPROVIDER', external_id: 'evt-exhausted' });
    expect(row.attempts).toBe(1);
    expect(row.max_attempts).toBe(1);
    expect(row.next_attempt_at).toBeNull();
  });

  it('times out a hung processor and schedules a retry', async () => {
    webhookService.registerProcessor('TESTPROVIDER', () => new Promise(() => {})); // never resolves
    const original = webhookService.DEFAULT_TIMEOUT_MS;
    webhookService.DEFAULT_TIMEOUT_MS = 20;
    try {
      await expect(
        webhookService.receiveWebhook({ provider: 'TESTPROVIDER', event: 'e', externalId: 'evt-timeout', payload: {} }),
      ).rejects.toThrow(/timed out/);
      const row = await Webhook.findOne({ provider: 'TESTPROVIDER', external_id: 'evt-timeout' });
      expect(row.status).toBe('FAILED');
    } finally {
      webhookService.DEFAULT_TIMEOUT_MS = original;
    }
  });
});

describe('webhookService.retryFailed', () => {
  afterEach(() => {
    webhookService.registerProcessor('TESTPROVIDER', undefined);
  });

  it('replays a FAILED row whose retry window has elapsed and marks it SUCCESS', async () => {
    const handler = jest.fn().mockResolvedValue('ok');
    webhookService.registerProcessor('TESTPROVIDER', handler);
    await webhookRepository.create({
      id: 1,
      provider: 'TESTPROVIDER',
      event: 'e',
      external_id: 'evt-1',
      payload: {},
      status: 'FAILED',
      attempts: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000),
    });

    await webhookService.retryFailed();

    expect(handler).toHaveBeenCalledTimes(1);
    const row = await Webhook.findOne({ id: 1 });
    expect(row.status).toBe('SUCCESS');
  });

  it('does not touch a FAILED row whose retry window has not elapsed', async () => {
    const handler = jest.fn().mockResolvedValue('ok');
    webhookService.registerProcessor('TESTPROVIDER', handler);
    await webhookRepository.create({
      id: 1,
      provider: 'TESTPROVIDER',
      event: 'e',
      external_id: 'evt-1',
      payload: {},
      status: 'FAILED',
      attempts: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() + 60000),
    });

    await webhookService.retryFailed();
    expect(handler).not.toHaveBeenCalled();
  });

  it('resets a row stuck PROCESSING past the stale timeout back to FAILED', async () => {
    await webhookRepository.create({
      id: 1,
      provider: 'TESTPROVIDER',
      event: 'e',
      external_id: 'evt-1',
      payload: {},
      status: 'PROCESSING',
      attempts: 1,
      last_attempt_at: new Date(Date.now() - 10 * 60 * 1000),
    });

    await webhookService.retryFailed();
    const row = await Webhook.findOne({ id: 1 });
    expect(row.status).toBe('FAILED');
  });
});

describe('webhookService.logReceived / logOutcome', () => {
  it('never throws even if the underlying write fails', async () => {
    jest.spyOn(webhookRepository, 'create').mockRejectedValueOnce(new Error('db down'));
    const result = await webhookService.logReceived({ provider: 'MOMO', event: 'e', externalId: 'x', payload: {} });
    expect(result).toBeNull();

    jest.spyOn(webhookRepository, 'markSuccess').mockRejectedValueOnce(new Error('db down'));
    await expect(webhookService.logOutcome({ id: 1 }, { success: true })).resolves.toBeNull();
  });

  it('logs a received event as PROCESSING and an outcome updates its status', async () => {
    const log = await webhookService.logReceived({
      provider: 'MOMO',
      event: 'payment.success',
      externalId: 'ORDER-1:tx-1',
      payload: { password: 'secret' },
      signatureVerified: true,
    });
    expect(log.status).toBe('PROCESSING');
    expect(log.payload.password).toBe('[REDACTED]');

    const outcome = await webhookService.logOutcome(log, { success: true });
    expect(outcome.status).toBe('SUCCESS');
  });

  it('a repeated logReceived call for the same (provider, external_id) reuses the same row', async () => {
    const first = await webhookService.logReceived({ provider: 'MOMO', event: 'e', externalId: 'ORDER-DUP', payload: {} });
    const second = await webhookService.logReceived({ provider: 'MOMO', event: 'e', externalId: 'ORDER-DUP', payload: {} });
    expect(second.id).toBe(first.id);
    expect(await Webhook.countDocuments()).toBe(1);
  });
});
