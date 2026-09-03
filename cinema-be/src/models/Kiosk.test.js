const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Kiosk = require('./Kiosk');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Kiosk model', () => {
  it('defaults status to ACTIVE and last_seen_at to null', async () => {
    const kiosk = await Kiosk.create({
      id: 1,
      kiosk_code: 'KSK-1',
      name: 'Lobby kiosk',
      branch_id: 3,
      guest_account_id: 500,
      api_key_hash: 'hash',
    });
    expect(kiosk.status).toBe('ACTIVE');
    expect(kiosk.last_seen_at).toBeNull();
  });

  it('never exposes api_key_hash through toJSON', async () => {
    const kiosk = await Kiosk.create({
      id: 2,
      kiosk_code: 'KSK-2',
      name: 'Kiosk 2',
      branch_id: 3,
      guest_account_id: 501,
      api_key_hash: 'secret-hash',
    });
    const json = kiosk.toJSON();
    expect(json.api_key_hash).toBeUndefined();
    expect(json._id).toBeUndefined();
    expect(json.kiosk_code).toBe('KSK-2');
  });

  it('exposes the STATUSES enum', () => {
    expect(Kiosk.STATUSES).toEqual(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);
  });

  it('rejects an out-of-enum status', async () => {
    await expect(
      Kiosk.create({ id: 5, kiosk_code: 'KSK-5', name: 'X', branch_id: 1, guest_account_id: 1, api_key_hash: 'h', status: 'BOGUS' }),
    ).rejects.toThrow();
  });
});
