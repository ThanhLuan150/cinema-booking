const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Webhook = require('../models/Webhook');
const webhookRepository = require('./webhook.repository');

beforeAll(async () => {
  await connect();
  await Webhook.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, provider: 'MOMO', event: 'payment.success', ...overrides };
}

describe('webhook.repository', () => {
  describe('create (idempotency)', () => {
    it('creates a new row for a fresh (provider, external_id) pair', async () => {
      const webhook = await webhookRepository.create(baseFields({ external_id: 'ORDER-1' }));
      expect(webhook.id).toBe(1);
      expect(await Webhook.countDocuments()).toBe(1);
    });

    it('returns the existing row instead of creating a duplicate for a repeated external_id', async () => {
      const first = await webhookRepository.create(baseFields({ id: 1, external_id: 'ORDER-1' }));
      const second = await webhookRepository.create(baseFields({ id: 2, external_id: 'ORDER-1' }));
      expect(second.id).toBe(first.id);
      expect(await Webhook.countDocuments()).toBe(1);
    });

    it('never processes a duplicate event: two concurrent deliveries of the same event dedupe to one row', async () => {
      const [a, b] = await Promise.all([
        webhookRepository.create(baseFields({ id: 1, external_id: 'ORDER-DUP' })),
        webhookRepository.create(baseFields({ id: 2, external_id: 'ORDER-DUP' })),
      ]);
      expect(a.id).toBe(b.id);
      expect(await Webhook.countDocuments()).toBe(1);
    });

    it('allows many rows with no external_id at all (sparse index)', async () => {
      await webhookRepository.create(baseFields({ id: 1 }));
      await webhookRepository.create(baseFields({ id: 2 }));
      expect(await Webhook.countDocuments()).toBe(2);
    });
  });

  describe('claimForProcessing', () => {
    it('claims a PENDING row and flips it to PROCESSING, incrementing attempts', async () => {
      await Webhook.create(baseFields());
      const claimed = await webhookRepository.claimForProcessing(1);
      expect(claimed.status).toBe('PROCESSING');
      expect(claimed.attempts).toBe(1);
      expect(claimed.last_attempt_at).toBeInstanceOf(Date);
    });

    it('claims a FAILED row for retry', async () => {
      await Webhook.create(baseFields({ status: 'FAILED', attempts: 1 }));
      const claimed = await webhookRepository.claimForProcessing(1);
      expect(claimed.status).toBe('PROCESSING');
      expect(claimed.attempts).toBe(2);
    });

    it('refuses to claim a row already PROCESSING or SUCCESS', async () => {
      await Webhook.create(baseFields({ status: 'PROCESSING' }));
      expect(await webhookRepository.claimForProcessing(1)).toBeNull();
      await Webhook.findOneAndUpdate({ id: 1 }, { status: 'SUCCESS' });
      expect(await webhookRepository.claimForProcessing(1)).toBeNull();
    });

    it('does not process a duplicate event concurrently: only one of two concurrent claims wins', async () => {
      await Webhook.create(baseFields());
      const [a, b] = await Promise.all([
        webhookRepository.claimForProcessing(1),
        webhookRepository.claimForProcessing(1),
      ]);
      const winners = [a, b].filter(Boolean);
      expect(winners).toHaveLength(1);
      const row = await Webhook.findOne({ id: 1 });
      expect(row.attempts).toBe(1);
    });
  });

  describe('markSuccess / markFailed', () => {
    it('markSuccess sets processed_at and clears the retry schedule', async () => {
      await Webhook.create(baseFields({ status: 'PROCESSING', next_attempt_at: new Date() }));
      const updated = await webhookRepository.markSuccess(1);
      expect(updated.status).toBe('SUCCESS');
      expect(updated.processed_at).toBeInstanceOf(Date);
      expect(updated.next_attempt_at).toBeNull();
    });

    it('markFailed records the error and schedules the next attempt', async () => {
      const nextAttemptAt = new Date(Date.now() + 60000);
      await Webhook.create(baseFields({ status: 'PROCESSING' }));
      const updated = await webhookRepository.markFailed(1, 'boom', { nextAttemptAt });
      expect(updated.status).toBe('FAILED');
      expect(updated.last_error).toBe('boom');
      expect(updated.next_attempt_at.getTime()).toBe(nextAttemptAt.getTime());
    });

    it('markFailed truncates an overly long error message', async () => {
      await Webhook.create(baseFields());
      const updated = await webhookRepository.markFailed(1, 'x'.repeat(5000));
      expect(updated.last_error.length).toBe(2000);
    });
  });

  describe('findStaleProcessing / resetStaleToFailed', () => {
    it('finds a row stuck PROCESSING past the cutoff and resets it to FAILED', async () => {
      const staleAt = new Date(Date.now() - 10 * 60 * 1000);
      await Webhook.create(baseFields({ status: 'PROCESSING', last_attempt_at: staleAt }));
      const cutoff = new Date(Date.now() - 2 * 60 * 1000);
      const stale = await webhookRepository.findStaleProcessing(cutoff);
      expect(stale).toHaveLength(1);
      const reset = await webhookRepository.resetStaleToFailed(stale[0].id);
      expect(reset.status).toBe('FAILED');
      expect(reset.next_attempt_at).toBeInstanceOf(Date);
    });

    it('does not treat a recently-touched PROCESSING row as stale', async () => {
      await Webhook.create(baseFields({ status: 'PROCESSING', last_attempt_at: new Date() }));
      const cutoff = new Date(Date.now() - 2 * 60 * 1000);
      expect(await webhookRepository.findStaleProcessing(cutoff)).toHaveLength(0);
    });
  });

  describe('findRetryable', () => {
    it('finds a FAILED row whose retry window has elapsed and is under its attempt budget', async () => {
      await Webhook.create(baseFields({ status: 'FAILED', attempts: 1, max_attempts: 5, next_attempt_at: new Date(Date.now() - 1000) }));
      const retryable = await webhookRepository.findRetryable(new Date());
      expect(retryable).toHaveLength(1);
    });

    it('excludes a FAILED row that has exhausted its attempt budget', async () => {
      await Webhook.create(baseFields({ status: 'FAILED', attempts: 5, max_attempts: 5, next_attempt_at: new Date(Date.now() - 1000) }));
      expect(await webhookRepository.findRetryable(new Date())).toHaveLength(0);
    });

    it('excludes a FAILED row whose retry window has not elapsed yet', async () => {
      await Webhook.create(baseFields({ status: 'FAILED', attempts: 1, max_attempts: 5, next_attempt_at: new Date(Date.now() + 60000) }));
      expect(await webhookRepository.findRetryable(new Date())).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('paginates and filters by provider/status', async () => {
      await Webhook.create(baseFields({ id: 1, status: 'SUCCESS' }));
      await Webhook.create(baseFields({ id: 2, provider: 'STRIPE', status: 'FAILED' }));
      const { data, total } = await webhookRepository.list({ provider: 'MOMO' }, { skip: 0, limit: 20 });
      expect(total).toBe(1);
      expect(data[0].id).toBe(1);
    });
  });
});
