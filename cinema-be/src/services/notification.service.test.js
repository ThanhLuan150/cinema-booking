const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');

jest.mock('../utils/socket', () => ({ emitToAccount: jest.fn() }));
jest.mock('../utils/mailer', () => ({ sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }) }));

const notificationService = require('./notification.service');
const notificationRepository = require('../repositories/notification.repository');
const Notification = require('../models/Notification');
const Account = require('../models/Account');
const { emitToAccount } = require('../utils/socket');
const { sendNotificationEmail } = require('../utils/mailer');

beforeAll(async () => {
  await connect();
  await Notification.init();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
afterAll(async () => closeDatabase());

const { EVENT, CHANNEL } = notificationService;

describe('notification.service.notify', () => {
  it('writes an in-app row, pushes a socket event and marks it SENT', async () => {
    const n = await notificationService.notify({ event: EVENT.BOOKING_CREATED, accountId: 7, data: { bookingCode: 'BK-9' } });
    expect(n).not.toBeNull();
    expect(emitToAccount).toHaveBeenCalledWith(7, 'notification:new', expect.objectContaining({ type: 'BOOKING_CREATED' }));

    const row = await notificationRepository.findById(n.id);
    expect(row.status).toBe('SENT');
    expect(row.sent_at).toBeInstanceOf(Date);
    expect(row.title).toBe('Booking created');
    expect(row.data.bookingCode).toBe('BK-9');
  });

  it('does not send a duplicate notification for the same event + recipient + booking', async () => {
    const first = await notificationService.notify({ event: EVENT.PAYMENT_SUCCESS, accountId: 7, bookingId: 1 });
    const second = await notificationService.notify({ event: EVENT.PAYMENT_SUCCESS, accountId: 7, bookingId: 1 });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await Notification.countDocuments()).toBe(1);
  });

  it('never throws — a persistence failure cannot break the caller', async () => {
    jest.spyOn(notificationRepository, 'create').mockRejectedValueOnce(new Error('db down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      notificationService.notify({ event: EVENT.BOOKING_CREATED, accountId: 7 }),
    ).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('ignores calls with no event or no recipient', async () => {
    expect(await notificationService.notify({ accountId: 7 })).toBeNull();
    expect(await notificationService.notify({ event: EVENT.BOOKING_CREATED })).toBeNull();
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('stores only safe context — no e-mail / token / PII leaks into data', async () => {
    await Account.create({ id: 7, email: 'someone@example.com', password: 'x', name: 'Someone' });
    const n = await notificationService.notify({
      event: EVENT.TICKET_ISSUED,
      accountId: 7,
      data: { movie: 'Dune', bookingCode: 'BK-1', seats: ['A1'] },
      channels: [CHANNEL.IN_APP, CHANNEL.EMAIL],
    });
    const serialized = JSON.stringify(n.toJSON());
    expect(serialized).not.toContain('someone@example.com');
    expect(serialized).not.toContain('password');
    expect(n.data).toEqual({ movie: 'Dune', bookingCode: 'BK-1', seats: ['A1'] });
  });
});

describe('notification.service retry', () => {
  it('marks a row FAILED with a backoff window when the e-mail send throws', async () => {
    await Account.create({ id: 7, email: 'a@b.com', password: 'x', name: 'A' });
    sendNotificationEmail.mockRejectedValueOnce(new Error('smtp 500'));

    const n = await notificationService.notify({
      event: EVENT.PAYMENT_SUCCESS,
      accountId: 7,
      channels: [CHANNEL.IN_APP, CHANNEL.EMAIL],
    });

    const row = await notificationRepository.findById(n.id);
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toContain('smtp 500');
    expect(row.next_attempt_at).toBeInstanceOf(Date);
  });

  it('retryFailed re-delivers a due row and can succeed on the next try', async () => {
    await Account.create({ id: 7, email: 'a@b.com', password: 'x', name: 'A' });
    sendNotificationEmail.mockRejectedValueOnce(new Error('smtp 500'));
    const n = await notificationService.notify({
      event: EVENT.SHOWTIME_CANCELLED,
      accountId: 7,
      channels: [CHANNEL.IN_APP, CHANNEL.EMAIL],
    });
    // force the backoff window open
    await notificationRepository.markFailed(n.id, { error: 'smtp 500', attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) });

    const processed = await notificationService.retryFailed({ now: new Date() });
    expect(processed).toBe(1);
    const row = await notificationRepository.findById(n.id);
    expect(row.status).toBe('SENT');
    expect(sendNotificationEmail).toHaveBeenCalledTimes(2);
  });

  it('stops retrying once the attempt budget is exhausted', async () => {
    await Account.create({ id: 7, email: 'a@b.com', password: 'x', name: 'A' });
    sendNotificationEmail.mockRejectedValue(new Error('smtp always down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const row = await notificationRepository.create({
      accountId: 7, type: EVENT.PAYMENT_FAILED, title: 't', dedupeKey: 'k', maxAttempts: 2,
      channels: [CHANNEL.EMAIL],
    });
    await notificationRepository.markFailed(row.id, { error: 'x', attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) });

    await notificationService.retryFailed({ now: new Date() });
    const after = await notificationRepository.findById(row.id);
    expect(after.attempts).toBe(2);
    expect(after.next_attempt_at).toBeNull();
    expect(await notificationRepository.findRetryable(new Date(Date.now() + 1e9))).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

describe('notification.service.backoffFor', () => {
  it('grows exponentially and is capped', () => {
    expect(notificationService.backoffFor(1)).toBe(notificationService.BASE_BACKOFF_MS);
    expect(notificationService.backoffFor(2)).toBe(notificationService.BASE_BACKOFF_MS * 2);
    expect(notificationService.backoffFor(50)).toBe(notificationService.MAX_BACKOFF_MS);
  });
});
