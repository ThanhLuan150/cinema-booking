const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Payment = require('../models/Payment');
const paymentRepository = require('./payment.repository');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const basePayload = {
  code: 'BK-1',
  bookingId: 1,
  accountId: 1,
  branchId: 1,
  type: 'ONLINE',
  method: 'MOMO',
  amount: 100000,
};

describe('createPayment', () => {
  it('creates a new PENDING payment', async () => {
    const payment = await paymentRepository.createPayment(basePayload);
    expect(payment.status).toBe('PENDING');
    expect(payment.code).toBe('BK-1');
    expect(payment.paid_at).toBeNull();
  });

  it('stamps paid_at when created directly as PAID (counter sale)', async () => {
    const payment = await paymentRepository.createPayment({ ...basePayload, status: 'PAID' });
    expect(payment.status).toBe('PAID');
    expect(payment.paid_at).toBeInstanceOf(Date);
  });

  it('is idempotent on the same idempotency key: a repeat call returns the original row', async () => {
    const first = await paymentRepository.createPayment({ ...basePayload, idempotencyKey: 'key-1' });
    const second = await paymentRepository.createPayment({
      ...basePayload,
      code: 'BK-2',
      idempotencyKey: 'key-1',
    });
    expect(second.id).toBe(first.id);
    expect(second.code).toBe('BK-1');
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('is idempotent on the same code even without an idempotency key', async () => {
    const first = await paymentRepository.createPayment(basePayload);
    const second = await paymentRepository.createPayment(basePayload);
    expect(second.id).toBe(first.id);
    expect(await Payment.countDocuments()).toBe(1);
  });
});

describe('markPaidIfPending', () => {
  it('flips a PENDING payment to PAID and records the gateway transaction id', async () => {
    await paymentRepository.createPayment(basePayload);
    const { skip, payment } = await paymentRepository.markPaidIfPending('BK-1', { gatewayTransactionId: 'tx-1' });
    expect(skip).toBe(false);
    expect(payment.status).toBe('PAID');
    expect(payment.gateway_transaction_id).toBe('tx-1');
  });

  it('skips a duplicate callback once the payment already reached PAID', async () => {
    await paymentRepository.createPayment(basePayload);
    await paymentRepository.markPaidIfPending('BK-1', { gatewayTransactionId: 'tx-1' });
    const { skip, payment } = await paymentRepository.markPaidIfPending('BK-1', { gatewayTransactionId: 'tx-1-retry' });
    expect(skip).toBe(true);
    expect(payment.gateway_transaction_id).toBe('tx-1'); // unchanged by the duplicate call
  });

  it('does not skip when no payment row is tracked for the code (legacy path)', async () => {
    const { skip, payment } = await paymentRepository.markPaidIfPending('UNKNOWN-CODE');
    expect(skip).toBe(false);
    expect(payment).toBeNull();
  });
});

describe('markFailedIfPending', () => {
  it('flips a PENDING payment to FAILED', async () => {
    await paymentRepository.createPayment(basePayload);
    const updated = await paymentRepository.markFailedIfPending('BK-1', 'MoMo resultCode 1');
    expect(updated.status).toBe('FAILED');
    expect(updated.failure_reason).toBe('MoMo resultCode 1');
  });

  it('is a no-op once the payment already left PENDING/PROCESSING', async () => {
    await paymentRepository.createPayment(basePayload);
    await paymentRepository.markPaidIfPending('BK-1');
    const updated = await paymentRepository.markFailedIfPending('BK-1', 'late failure');
    expect(updated).toBeNull();
    expect((await paymentRepository.findByCode('BK-1')).status).toBe('PAID');
  });
});

describe('markProcessing', () => {
  it('flips a PENDING payment to PROCESSING', async () => {
    await paymentRepository.createPayment(basePayload);
    const updated = await paymentRepository.markProcessing('BK-1');
    expect(updated.status).toBe('PROCESSING');
  });

  it('is a no-op once the payment already left PENDING (e.g. already PROCESSING or PAID)', async () => {
    await paymentRepository.createPayment(basePayload);
    await paymentRepository.markProcessing('BK-1');
    const second = await paymentRepository.markProcessing('BK-1');
    expect(second).toBeNull();
  });

  it('is a no-op when no payment is tracked for the code', async () => {
    const updated = await paymentRepository.markProcessing('UNKNOWN-CODE');
    expect(updated).toBeNull();
  });
});

describe('refund lifecycle', () => {
  it('moves PAID -> REFUND_PENDING -> REFUNDED', async () => {
    const created = await paymentRepository.createPayment({ ...basePayload, status: 'PAID' });
    const requested = await paymentRepository.requestRefund(created.id, 'Customer request');
    expect(requested.status).toBe('REFUND_PENDING');
    expect(requested.refund_reason).toBe('Customer request');

    const completed = await paymentRepository.completeRefund(created.id, 99);
    expect(completed.status).toBe('REFUNDED');
    expect(completed.refunded_by).toBe(99);
    expect(completed.refunded_at).toBeInstanceOf(Date);
  });

  it('rejects requesting a refund on a payment that is not PAID', async () => {
    const created = await paymentRepository.createPayment(basePayload); // PENDING
    const requested = await paymentRepository.requestRefund(created.id, 'nope');
    expect(requested).toBeNull();
  });

  it('rejects confirming a refund that was never requested', async () => {
    const created = await paymentRepository.createPayment({ ...basePayload, status: 'PAID' });
    const completed = await paymentRepository.completeRefund(created.id, 1);
    expect(completed).toBeNull();
  });
});

describe('listForAccount / listAll', () => {
  it('paginates and filters by account', async () => {
    await paymentRepository.createPayment({ ...basePayload, accountId: 1, code: 'BK-1' });
    await paymentRepository.createPayment({ ...basePayload, accountId: 2, code: 'BK-2' });
    const { data, total } = await paymentRepository.listForAccount(1, { skip: 0, limit: 10 });
    expect(total).toBe(1);
    expect(data[0].account_id).toBe(1);
  });

  it('listAll applies an arbitrary filter', async () => {
    await paymentRepository.createPayment({ ...basePayload, code: 'BK-1', status: 'PAID' });
    await paymentRepository.createPayment({ ...basePayload, code: 'BK-2' });
    const { data, total } = await paymentRepository.listAll({ status: 'PAID' }, { skip: 0, limit: 10 });
    expect(total).toBe(1);
    expect(data[0].code).toBe('BK-1');
  });
});
