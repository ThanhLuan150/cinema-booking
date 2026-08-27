const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const notificationController = require('./notification.controller');
const notificationRepository = require('../repositories/notification.repository');
const Notification = require('../models/Notification');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => {
  await connect();
  await Notification.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seed() {
  await notificationRepository.create({ accountId: 7, type: 'BOOKING_CREATED', title: 'a', dedupeKey: 'a' });
  await notificationRepository.create({ accountId: 7, type: 'PAYMENT_SUCCESS', title: 'b', dedupeKey: 'b' });
  await notificationRepository.create({ accountId: 99, type: 'BOOKING_CREATED', title: 'c', dedupeKey: 'c' });
}

describe('notification.controller.list', () => {
  it('returns only the caller own notifications, paginated', async () => {
    await seed();
    const res = mockRes();
    await notificationController.list({ account: { accountId: 7 }, query: {} }, res);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(2);
    expect(body.data.every((n) => n.account_id === 7)).toBe(true);
  });

  it('can filter to unread only', async () => {
    await seed();
    await notificationRepository.markRead(1, 7);
    const res = mockRes();
    await notificationController.list({ account: { accountId: 7 }, query: { unread: 'true' } }, res);
    expect(res.json.mock.calls[0][0].total).toBe(1);
  });
});

describe('notification.controller.unreadCount', () => {
  it('counts unread rows for the caller', async () => {
    await seed();
    const res = mockRes();
    await notificationController.unreadCount({ account: { accountId: 7 }, query: {} }, res);
    expect(res.json.mock.calls[0][0]).toEqual({ count: 2 });
  });
});

describe('notification.controller.markRead', () => {
  it('marks the caller own row read', async () => {
    await seed();
    const res = mockRes();
    await notificationController.markRead({ account: { accountId: 7 }, params: { id: 1 } }, res);
    expect(res.json.mock.calls[0][0].read_at).toBeTruthy();
  });

  it('404s a row that belongs to someone else', async () => {
    await seed();
    const res = mockRes();
    await notificationController.markRead({ account: { accountId: 7 }, params: { id: 3 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('notification.controller.markAllRead', () => {
  it('marks every unread row for the caller and reports the count', async () => {
    await seed();
    const res = mockRes();
    await notificationController.markAllRead({ account: { accountId: 7 }, query: {} }, res);
    expect(res.json.mock.calls[0][0]).toEqual({ updated: 2 });
    expect(await notificationRepository.countUnread(7)).toBe(0);
    expect(await notificationRepository.countUnread(99)).toBe(1);
  });
});
