const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const kioskRepository = require('./kiosk.repository');
const Kiosk = require('../models/Kiosk');
const { hashKioskKey } = require('../utils/kioskKey');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seed(overrides = {}) {
  return Kiosk.create({
    id: 1,
    kiosk_code: 'KSK-1',
    name: 'Kiosk 1',
    branch_id: 7,
    guest_account_id: 900,
    api_key_hash: hashKioskKey('KIOSK-abc'),
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('kiosk.repository', () => {
  it('findFiltered paginates and filters by branch/status', async () => {
    await seed({ id: 1, kiosk_code: 'K1', branch_id: 7, status: 'ACTIVE' });
    await seed({ id: 2, kiosk_code: 'K2', branch_id: 7, status: 'INACTIVE', guest_account_id: 901 });
    await seed({ id: 3, kiosk_code: 'K3', branch_id: 8, status: 'ACTIVE', guest_account_id: 902 });

    const all = await kioskRepository.findFiltered({ branch_id: 7 });
    expect(all.total).toBe(2);

    const active = await kioskRepository.findFiltered({ branch_id: 7, status: 'ACTIVE' });
    expect(active.total).toBe(1);
    expect(active.data[0].kiosk_code).toBe('K1');
  });

  it('looks up by id, kiosk_code and api key hash', async () => {
    await seed();
    expect((await kioskRepository.findById(1)).kiosk_code).toBe('KSK-1');
    expect((await kioskRepository.findByKioskCode('KSK-1')).id).toBe(1);
    expect((await kioskRepository.findByApiKeyHash(hashKioskKey('KIOSK-abc'))).id).toBe(1);
    expect(await kioskRepository.findByApiKeyHash('nope')).toBeNull();
  });

  it('findBranchIdByKioskId returns the branch or null', async () => {
    await seed();
    expect(await kioskRepository.findBranchIdByKioskId(1)).toBe(7);
    expect(await kioskRepository.findBranchIdByKioskId(999)).toBeNull();
  });

  it('updateFields / touchLastSeen / remove', async () => {
    await seed();
    const updated = await kioskRepository.updateFields(1, { status: 'MAINTENANCE' });
    expect(updated.status).toBe('MAINTENANCE');

    await kioskRepository.touchLastSeen(1);
    expect((await kioskRepository.findById(1)).last_seen_at).not.toBeNull();

    await kioskRepository.remove(1);
    expect(await kioskRepository.findById(1)).toBeNull();
  });
});
