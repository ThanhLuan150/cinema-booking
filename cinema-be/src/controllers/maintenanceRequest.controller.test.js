const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const maintenanceRequestController = require('./maintenanceRequest.controller');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Room = require('../models/Room');
const Seat = require('../models/Seat');
const Employee = require('../models/Employee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const reporter = { accountId: 7, email: 'reporter@example.com', role: 3 };

async function seedRoom(overrides = {}) {
  return Room.create({ id: 1, cinema_id: 1, name: 'Room 1', code: 'R1', status: 'ACTIVE', ...overrides });
}

describe('maintenanceRequest.controller', () => {
  describe('create', () => {
    it('rejects missing resource_type/title', async () => {
      const res = mockRes();
      await maintenanceRequestController.create({ body: {}, branchId: 1, account: reporter }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an invalid resource_type', async () => {
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'FRIDGE', title: 'Broken' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESOURCE_TYPE' }));
    });

    it('requires room_id for a ROOM request and 404s on an unknown room', async () => {
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'ROOM', title: 'Flicker' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      const res2 = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'ROOM', room_id: 999, title: 'Flicker' }, branchId: 1, account: reporter },
        res2,
      );
      expect(res2.status).toHaveBeenCalledWith(404);
    });

    it('rejects a room from a different branch', async () => {
      await seedRoom({ cinema_id: 2 });
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'ROOM', room_id: 1, title: 'Flicker' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('creates a ROOM request and puts the room under MAINTENANCE', async () => {
      await seedRoom();
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'ROOM', room_id: 1, title: 'Flicker' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect((await Room.findOne({ id: 1 })).status).toBe('MAINTENANCE');
      const request = await MaintenanceRequest.findOne({ resource_type: 'ROOM' });
      expect(request.reported_by).toBe(7);
      expect(request.status).toBe('OPEN');
    });

    it('does not touch a room that is already CLOSED', async () => {
      await seedRoom({ status: 'CLOSED' });
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'ROOM', room_id: 1, title: 'Flicker' }, branchId: 1, account: reporter },
        res,
      );
      expect((await Room.findOne({ id: 1 })).status).toBe('CLOSED');
    });

    it('creates a SEAT request and derives room_id from the seat', async () => {
      await seedRoom();
      await Seat.create({ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1' });
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'SEAT', seat_id: 1, title: 'Broken armrest' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const request = await MaintenanceRequest.findOne({ resource_type: 'SEAT' });
      expect(request.room_id).toBe(1);
      expect(request.resource_name).toBe('A1');
      // A broken seat alone doesn't block the whole room's showtimes.
      expect((await Room.findOne({ id: 1 })).status).toBe('ACTIVE');
    });

    it('requires resource_name for an unmodeled resource type', async () => {
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'POS', title: 'POS terminal frozen' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RESOURCE_NAME_REQUIRED' }));
    });

    it('creates a POS request with a free-text resource_name and no room side effect', async () => {
      const res = mockRes();
      await maintenanceRequestController.create(
        { body: { resource_type: 'POS', resource_name: 'Counter 2 POS', title: 'POS terminal frozen' }, branchId: 1, account: reporter },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const request = await MaintenanceRequest.findOne({ resource_type: 'POS' });
      expect(request.resource_name).toBe('Counter 2 POS');
      expect(request.room_id).toBeNull();
    });
  });

  describe('update', () => {
    it('404s for an unknown request', async () => {
      const res = mockRes();
      await maintenanceRequestController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects editing a CLOSED request', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', status: 'CLOSED', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.update({ params: { id: 1 }, body: { title: 'Y' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MAINTENANCE_CLOSED' }));
    });

    it('updates the title', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.update({ params: { id: 1 }, body: { title: 'Y' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Y' }));
    });
  });

  describe('assign', () => {
    async function seedOpenRequestAndEmployee({ employeeBranchId = 1, employeeStatus = 1 } = {}) {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', reported_by: 7 });
      await Employee.create({ id: 5, user_id: 20, branch_id: employeeBranchId, employee_code: 'EMP-000005', position_id: 1, status: employeeStatus });
    }

    it('requires employee_id', async () => {
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: {}, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404s for an unknown employee', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: { employee_id: 999 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects an inactive employee', async () => {
      await seedOpenRequestAndEmployee({ employeeStatus: 0 });
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPLOYEE_NOT_ACTIVE' }));
    });

    it('rejects an employee from a different branch', async () => {
      await seedOpenRequestAndEmployee({ employeeBranchId: 2 });
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_MISMATCH' }));
    });

    it('assigns the employee and moves to ASSIGNED', async () => {
      await seedOpenRequestAndEmployee();
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ASSIGNED', assigned_employee_id: 5 }));
    });

    it('rejects assigning once the request is already IN_PROGRESS', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', status: 'IN_PROGRESS', reported_by: 7 });
      await Employee.create({ id: 5, user_id: 20, branch_id: 1, employee_code: 'EMP-000005', position_id: 1, status: 1 });
      const res = mockRes();
      await maintenanceRequestController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MAINTENANCE_NOT_ASSIGNABLE' }));
    });
  });

  describe('start / resolve / close lifecycle', () => {
    it('rejects start when not ASSIGNED', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.start({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MAINTENANCE_NOT_ASSIGNED' }));
    });

    it('moves ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
      await MaintenanceRequest.create({
        id: 1,
        branch_id: 1,
        resource_type: 'POS',
        resource_name: 'POS',
        title: 'X',
        status: 'ASSIGNED',
        assigned_employee_id: 5,
        reported_by: 7,
      });

      const startRes = mockRes();
      await maintenanceRequestController.start({ params: { id: 1 } }, startRes);
      expect(startRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));

      const resolveRes = mockRes();
      await maintenanceRequestController.resolve({ params: { id: 1 }, body: { resolution_note: 'Rebooted terminal' } }, resolveRes);
      expect(resolveRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'RESOLVED', resolution_note: 'Rebooted terminal' }));

      const closeRes = mockRes();
      await maintenanceRequestController.close({ params: { id: 1 }, account: { accountId: 42 } }, closeRes);
      expect(closeRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'CLOSED' }));
    });

    it('resolving a ROOM request restores the room to ACTIVE once no other request is still open', async () => {
      await seedRoom({ status: 'MAINTENANCE' });
      await MaintenanceRequest.create({
        id: 1,
        branch_id: 1,
        resource_type: 'ROOM',
        room_id: 1,
        title: 'Flicker',
        status: 'IN_PROGRESS',
        reported_by: 7,
      });

      const res = mockRes();
      await maintenanceRequestController.resolve({ params: { id: 1 }, body: {} }, res);
      expect((await Room.findOne({ id: 1 })).status).toBe('ACTIVE');
    });

    it('resolving a ROOM request leaves the room in MAINTENANCE while another request is still open', async () => {
      await seedRoom({ status: 'MAINTENANCE' });
      await MaintenanceRequest.create([
        { id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Flicker', status: 'IN_PROGRESS', reported_by: 7 },
        { id: 2, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'AC broken', status: 'OPEN', reported_by: 8 },
      ]);

      const res = mockRes();
      await maintenanceRequestController.resolve({ params: { id: 1 }, body: {} }, res);
      expect((await Room.findOne({ id: 1 })).status).toBe('MAINTENANCE');
    });
  });

  describe('remove', () => {
    it('rejects deleting a request that is no longer OPEN', async () => {
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'POS', title: 'X', status: 'ASSIGNED', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.remove({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MAINTENANCE_NOT_DELETABLE' }));
    });

    it('deletes an OPEN request and restores the room if it was the only one', async () => {
      await seedRoom({ status: 'MAINTENANCE' });
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Flicker', status: 'OPEN', reported_by: 7 });
      const res = mockRes();
      await maintenanceRequestController.remove({ params: { id: 1 } }, res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
      expect(await MaintenanceRequest.findOne({ id: 1 })).toBeNull();
      expect((await Room.findOne({ id: 1 })).status).toBe('ACTIVE');
    });
  });
});
