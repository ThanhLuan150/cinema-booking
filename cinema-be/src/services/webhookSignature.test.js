const crypto = require('crypto');
const webhookSignature = require('./webhookSignature');

describe('webhookSignature.verify', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.MOMO_SECRET_KEY;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('delegates MOMO to the MoMo HMAC verifier and reports it as required', () => {
    // No MOMO_SECRET_KEY configured -> momo.verifyMomoSignature's own mock-mode fallback
    // accepts anything, but the provider is still reported as requiring verification.
    const result = webhookSignature.verify({ provider: 'MOMO', body: { resultCode: '0' } });
    expect(result.required).toBe(true);
    expect(result.verified).toBe(true);
  });

  it('is not required for a generic provider with no secret configured', () => {
    const result = webhookSignature.verify({ provider: 'SENDGRID', body: { event: 'delivered' } });
    expect(result).toEqual({ required: false, verified: false });
  });

  it('verifies a generic provider HMAC signature against the shared secret', () => {
    const secret = 'shh';
    const body = { event: 'delivered', id: 'evt_1' };
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    const result = webhookSignature.verify({
      provider: 'SENDGRID',
      body,
      headers: { 'x-webhook-signature': signature },
      secret,
    });
    expect(result).toEqual({ required: true, verified: true });
  });

  it('accepts the sha256= prefixed style some providers use', () => {
    const secret = 'shh';
    const body = { event: 'delivered' };
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    const result = webhookSignature.verify({
      provider: 'SENDGRID',
      body,
      headers: { 'x-webhook-signature': `sha256=${signature}` },
      secret,
    });
    expect(result.verified).toBe(true);
  });

  it('rejects a tampered body against a valid signature', () => {
    const secret = 'shh';
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify({ event: 'a' })).digest('hex');
    const result = webhookSignature.verify({
      provider: 'SENDGRID',
      body: { event: 'b' },
      headers: { 'x-webhook-signature': signature },
      secret,
    });
    expect(result).toEqual({ required: true, verified: false });
  });

  it('rejects a missing signature header when a secret is configured', () => {
    const result = webhookSignature.verify({ provider: 'SENDGRID', body: {}, headers: {}, secret: 'shh' });
    expect(result).toEqual({ required: true, verified: false });
  });
});
