const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const templateRepository = require('./notificationTemplate.repository');
const NotificationTemplate = require('../models/NotificationTemplate');

beforeAll(async () => {
  await connect();
  await NotificationTemplate.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const { EVENT, CHANNEL, STATUS } = NotificationTemplate;

const base = {
  event: EVENT.BOOKING_SUCCESS,
  channel: CHANNEL.EMAIL,
  subject: 'S {{customer_name}}',
  content: 'C {{booking_code}}',
  language: 'vi',
  status: STATUS.ACTIVE,
};

describe('notificationTemplate.repository', () => {
  it('create auto-increments id', async () => {
    const a = await templateRepository.create(base);
    const b = await templateRepository.create({ ...base, language: 'en' });
    expect(b.id).toBe(a.id + 1);
  });

  it('create surfaces the duplicate-key error for a repeated (event, channel, language)', async () => {
    await templateRepository.create(base);
    await expect(templateRepository.create(base)).rejects.toMatchObject({ code: 11000 });
  });

  it('findActive returns only an ACTIVE row for the exact key', async () => {
    await templateRepository.create({ ...base, status: STATUS.INACTIVE });
    expect(await templateRepository.findActive({ event: EVENT.BOOKING_SUCCESS, channel: CHANNEL.EMAIL, language: 'vi' })).toBeNull();

    await NotificationTemplate.updateOne({ event: EVENT.BOOKING_SUCCESS }, { $set: { status: STATUS.ACTIVE } });
    const found = await templateRepository.findActive({ event: EVENT.BOOKING_SUCCESS, channel: CHANNEL.EMAIL, language: 'vi' });
    expect(found.content).toBe('C {{booking_code}}');
  });

  it('findFiltered filters by event / channel / language / status and paginates', async () => {
    await templateRepository.create({ ...base, event: EVENT.BOOKING_SUCCESS });
    await templateRepository.create({ ...base, event: EVENT.PAYMENT_SUCCESS });
    await templateRepository.create({ ...base, event: EVENT.PAYMENT_SUCCESS, channel: CHANNEL.IN_APP });

    const byEvent = await templateRepository.findFiltered({ event: EVENT.PAYMENT_SUCCESS }, { skip: 0, limit: 10 });
    expect(byEvent.total).toBe(2);

    const byChannel = await templateRepository.findFiltered({ channel: CHANNEL.IN_APP }, { skip: 0, limit: 10 });
    expect(byChannel.total).toBe(1);

    const page1 = await templateRepository.findFiltered({}, { skip: 0, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(3);
  });

  it('updateById patches fields and deleteById removes the row', async () => {
    const created = await templateRepository.create(base);
    const updated = await templateRepository.updateById(created.id, { status: STATUS.INACTIVE });
    expect(updated.status).toBe('INACTIVE');

    const removed = await templateRepository.deleteById(created.id);
    expect(removed.id).toBe(created.id);
    expect(await templateRepository.findById(created.id)).toBeNull();
  });
});
