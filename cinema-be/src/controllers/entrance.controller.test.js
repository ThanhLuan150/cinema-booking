const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const entranceController = require('./entrance.controller');
const Entrance = require('../models/Entrance');
const Device = require('../models/Device');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('entrance.controller', () => {
  describe('create', () => {
    it('rejects a missing name', async () => {
      const res = mockRes();
      await entranceController.create({ body: {}, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a duplicate code within the branch', async () => {
      await Entrance.create({ id: 1, branch_id: 1, name: 'A', code: 'G1' });
      const res = mockRes();
      await entranceController.create({ body: { name: 'B', code: 'G1' }, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENTRANCE_CODE_TAKEN' }));
    });

    it('creates an entrance on the caller-scoped branch', async () => {
      const res = mockRes();
      await entranceController.create({ body: { name: 'Main lobby', code: 'G1' }, branchId: 7 }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const created = res.json.mock.calls[0][0];
      expect(created.branch_id).toBe(7);
      expect(created.status).toBe('ACTIVE');
    });
  });

  describe('update', () => {
    it('rejects an invalid status', async () => {
      await Entrance.create({ id: 1, branch_id: 1, name: 'A' });
      const res = mockRes();
      await entranceController.update({ params: { id: 1 }, body: { status: 'NOPE' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates the name and status', async () => {
      await Entrance.create({ id: 1, branch_id: 1, name: 'A' });
      const res = mockRes();
      await entranceController.update({ params: { id: 1 }, body: { name: 'Gate B', status: 'INACTIVE' } }, res);
      const updated = res.json.mock.calls[0][0];
      expect(updated.name).toBe('Gate B');
      expect(updated.status).toBe('INACTIVE');
    });
  });

  describe('remove', () => {
    it('refuses while a device is still pinned to the entrance', async () => {
      await Entrance.create({ id: 1, branch_id: 1, name: 'A' });
      await Device.create({ id: 1, device_id: 'D1', name: 'S', branch_id: 1, entrance_id: 1, api_key_hash: 'x' });
      const res = mockRes();
      await entranceController.remove({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENTRANCE_HAS_DEVICES' }));
    });

    it('deletes an entrance with no devices', async () => {
      await Entrance.create({ id: 1, branch_id: 1, name: 'A' });
      const res = mockRes();
      await entranceController.remove({ params: { id: 1 } }, res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
      expect(await Entrance.findOne({ id: 1 })).toBeNull();
    });
  });
});
