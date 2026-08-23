const crypto = require('crypto');

describe('momo utils', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MOMO_PARTNER_CODE;
    delete process.env.MOMO_ACCESS_KEY;
    delete process.env.MOMO_SECRET_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('encodeExtraData / decodeExtraData', () => {
    it('round-trips a payload through base64 JSON', () => {
      const { encodeExtraData, decodeExtraData } = require('./momo');
      const payload = { scheduleId: 12, seats: ['A1', 'A2'] };
      const encoded = encodeExtraData(payload);
      expect(decodeExtraData(encoded)).toEqual(payload);
    });

    it('encodes a missing payload as an empty object', () => {
      const { encodeExtraData, decodeExtraData } = require('./momo');
      expect(decodeExtraData(encodeExtraData())).toEqual({});
    });

    it('decodeExtraData returns an empty object for falsy input', () => {
      const { decodeExtraData } = require('./momo');
      expect(decodeExtraData(null)).toEqual({});
      expect(decodeExtraData('')).toEqual({});
    });

    it('decodeExtraData returns an empty object for malformed base64/JSON', () => {
      const { decodeExtraData } = require('./momo');
      expect(decodeExtraData('not-valid-base64-json')).toEqual({});
    });
  });

  describe('createMomoPaymentUrl (mock mode, no credentials configured)', () => {
    it('returns a mock redirect url carrying the encoded order payload', async () => {
      const { createMomoPaymentUrl, decodeExtraData } = require('./momo');
      const url = await createMomoPaymentUrl(50000, 'BK-1', { scheduleId: 7 });

      expect(url).toContain('resultCode=0');
      expect(url).toContain('Mock+payment+success');

      const parsed = new URL(url);
      const extraData = parsed.searchParams.get('extraData');
      expect(decodeExtraData(extraData)).toEqual({ scheduleId: 7 });
      expect(parsed.searchParams.get('amount')).toBe('50000');
      expect(parsed.searchParams.get('orderId')).toBe('BK-1');
    });

    it('clamps the amount to a minimum of 1000', async () => {
      const { createMomoPaymentUrl } = require('./momo');
      const url = await createMomoPaymentUrl(1, 'BK-2', {});
      const parsed = new URL(url);
      expect(parsed.searchParams.get('amount')).toBe('1000');
    });
  });

  describe('verifyMomoSignature', () => {
    it('returns true when no secret key is configured (mock mode)', () => {
      const { verifyMomoSignature } = require('./momo');
      expect(verifyMomoSignature({ signature: 'anything' })).toBe(true);
    });

    it('returns true for a correctly computed signature', () => {
      process.env.MOMO_SECRET_KEY = 'secret';
      process.env.MOMO_ACCESS_KEY = 'access';
      const { verifyMomoSignature } = require('./momo');

      const params = {
        amount: '10000',
        extraData: '',
        message: 'Success',
        orderId: 'order-1',
        orderInfo: 'Pay for cinema ticket',
        orderType: 'momo_wallet',
        partnerCode: 'PARTNER',
        payType: 'qr',
        requestId: 'req-1',
        responseTime: '123456',
        resultCode: '0',
        transId: 'tx-1',
      };

      const rawSignature =
        `accessKey=access&amount=${params.amount}&extraData=${params.extraData}&message=${params.message}` +
        `&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}&partnerCode=${params.partnerCode}` +
        `&payType=${params.payType}&requestId=${params.requestId}&responseTime=${params.responseTime}` +
        `&resultCode=${params.resultCode}&transId=${params.transId}`;
      const signature = crypto.createHmac('sha256', 'secret').update(rawSignature).digest('hex');

      expect(verifyMomoSignature({ ...params, signature })).toBe(true);
    });

    it('returns false for a tampered signature', () => {
      process.env.MOMO_SECRET_KEY = 'secret';
      const { verifyMomoSignature } = require('./momo');
      expect(verifyMomoSignature({ signature: 'tampered', amount: '10000' })).toBe(false);
    });
  });
});
