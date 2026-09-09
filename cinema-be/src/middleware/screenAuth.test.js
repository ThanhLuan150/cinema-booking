const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { requireScreen } = require('./screenAuth');
const Screen = require('../models/Screen');
const { generateScreenKey, hashScreenKey } = require('../utils/screenKey');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function seedScreen(key, overrides = {}) {
  return Screen.create({
    id: 1,
    branch_id: 1,
    name: 'Lobby wall',
    api_key_hash: hashScreenKey(key),
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('requireScreen', () => {
  it('401s when the X-Screen-Key header is absent', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireScreen({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an unrecognised key', async () => {
    await seedScreen(generateScreenKey());
    const res = mockRes();
    const next = jest.fn();
    await requireScreen({ headers: { 'x-screen-key': 'SCR-nope' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('403s when the screen is not ACTIVE', async () => {
    const key = generateScreenKey();
    await seedScreen(key, { status: 'MAINTENANCE' });
    const res = mockRes();
    const next = jest.fn();
    await requireScreen({ headers: { 'x-screen-key': key } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCREEN_NOT_ACTIVE' }));
  });

  it('attaches req.screen, refreshes last_seen_at and calls next on a valid key', async () => {
    const key = generateScreenKey();
    await seedScreen(key);
    const req = { headers: { 'x-screen-key': key } };
    const res = mockRes();
    const next = jest.fn();
    await requireScreen(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.screen.id).toBe(1);

    let screen;
    for (let i = 0; i < 50; i += 1) {
      screen = await Screen.findOne({ id: 1 });
      if (screen.last_seen_at) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(screen.last_seen_at).toBeInstanceOf(Date);
  });
});
