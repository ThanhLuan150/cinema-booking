const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const maintenanceRequestRepository = require('./maintenanceRequest.repository');
const MaintenanceRequest = require('../models/MaintenanceRequest');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    branch_id: 1,
    resource_type: 'ROOM',
    room_id: 1,
    title: 'Projector flickers',
    reported_by: 7,
    ...overrides,
  };
}

describe('maintenanceRequest.repository', () => {
  describe('findFiltered / findById / findBranchIdByRequestId', () => {
    it('filters and paginates', async () => {
      await MaintenanceRequest.create([
        baseFields({ id: 1, branch_id: 1 }),
        baseFields({ id: 2, branch_id: 2 }),
      ]);
      const { data, total } = await maintenanceRequestRepository.findFiltered({ branch_id: 1 }, { skip: 0, limit: 20 });
      expect(total).toBe(1);
      expect(data[0].id).toBe(1);
    });

    it('returns null branch id for an unknown request', async () => {
      expect(await maintenanceRequestRepository.findBranchIdByRequestId(999)).toBeNull();
    });

    it('returns the branch id for a known request', async () => {
      await MaintenanceRequest.create(baseFields());
      expect(await maintenanceRequestRepository.findBranchIdByRequestId(1)).toBe(1);
    });
  });

  describe('create / updateFields', () => {
    it('creates a request', async () => {
      const request = await maintenanceRequestRepository.create(baseFields());
      expect(request.status).toBe('OPEN');
    });

    it('updates editable fields', async () => {
      await MaintenanceRequest.create(baseFields());
      const updated = await maintenanceRequestRepository.updateFields(1, { title: 'Projector is dead' });
      expect(updated.title).toBe('Projector is dead');
    });
  });

  describe('assign', () => {
    it('moves OPEN -> ASSIGNED and stamps the assignment', async () => {
      await MaintenanceRequest.create(baseFields());
      const updated = await maintenanceRequestRepository.assign(1, { employeeId: 5, assignedBy: 42 });
      expect(updated.status).toBe('ASSIGNED');
      expect(updated.assigned_employee_id).toBe(5);
      expect(updated.assigned_by).toBe(42);
      expect(updated.assigned_at).toBeInstanceOf(Date);
    });

    it('allows re-assigning from ASSIGNED to a different employee', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'ASSIGNED', assigned_employee_id: 5 }));
      const updated = await maintenanceRequestRepository.assign(1, { employeeId: 6, assignedBy: 42 });
      expect(updated.assigned_employee_id).toBe(6);
    });

    it('returns null once the request is IN_PROGRESS', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'IN_PROGRESS' }));
      const updated = await maintenanceRequestRepository.assign(1, { employeeId: 5, assignedBy: 42 });
      expect(updated).toBeNull();
    });
  });

  describe('start', () => {
    it('moves ASSIGNED -> IN_PROGRESS', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'ASSIGNED', assigned_employee_id: 5 }));
      const updated = await maintenanceRequestRepository.start(1);
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.started_at).toBeInstanceOf(Date);
    });

    it('returns null when not ASSIGNED', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'OPEN' }));
      expect(await maintenanceRequestRepository.start(1)).toBeNull();
    });
  });

  describe('resolve', () => {
    it('moves IN_PROGRESS -> RESOLVED and stores the note', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'IN_PROGRESS' }));
      const updated = await maintenanceRequestRepository.resolve(1, { resolutionNote: 'Replaced the bulb' });
      expect(updated.status).toBe('RESOLVED');
      expect(updated.resolution_note).toBe('Replaced the bulb');
      expect(updated.resolved_at).toBeInstanceOf(Date);
    });

    it('returns null when not IN_PROGRESS', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'ASSIGNED' }));
      expect(await maintenanceRequestRepository.resolve(1, {})).toBeNull();
    });
  });

  describe('close', () => {
    it('moves RESOLVED -> CLOSED', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'RESOLVED' }));
      const updated = await maintenanceRequestRepository.close(1, { closedBy: 42 });
      expect(updated.status).toBe('CLOSED');
      expect(updated.closed_by).toBe(42);
      expect(updated.closed_at).toBeInstanceOf(Date);
    });

    it('returns null when not RESOLVED', async () => {
      await MaintenanceRequest.create(baseFields({ status: 'IN_PROGRESS' }));
      expect(await maintenanceRequestRepository.close(1, { closedBy: 42 })).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the request', async () => {
      await MaintenanceRequest.create(baseFields());
      await maintenanceRequestRepository.remove(1);
      expect(await MaintenanceRequest.findOne({ id: 1 })).toBeNull();
    });
  });

  describe('countActiveForRoom', () => {
    it('counts only ROOM requests in ACTIVE_STATUSES for that room', async () => {
      await MaintenanceRequest.create([
        baseFields({ id: 1, room_id: 10, status: 'OPEN' }),
        baseFields({ id: 2, room_id: 10, status: 'IN_PROGRESS' }),
        baseFields({ id: 3, room_id: 10, status: 'CLOSED' }),
        baseFields({ id: 4, room_id: 11, status: 'OPEN' }),
        baseFields({ id: 5, room_id: 10, resource_type: 'SEAT', seat_id: 1, status: 'OPEN' }),
      ]);
      expect(await maintenanceRequestRepository.countActiveForRoom(10)).toBe(2);
    });

    it('excludes the given id', async () => {
      await MaintenanceRequest.create(baseFields({ id: 1, room_id: 10, status: 'OPEN' }));
      expect(await maintenanceRequestRepository.countActiveForRoom(10, { excludeId: 1 })).toBe(0);
    });
  });
});
