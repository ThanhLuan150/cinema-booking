const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const supportTicketRepository = require('./supportTicket.repository');
const SupportTicket = require('../models/SupportTicket');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    customer_id: 10,
    branch_id: 1,
    subject: 'Cannot check in',
    created_by: 7,
    ...overrides,
  };
}

describe('supportTicket.repository', () => {
  describe('findFiltered / findById / findBranchIdByTicketId', () => {
    it('filters and paginates', async () => {
      await SupportTicket.create([baseFields({ id: 1, branch_id: 1 }), baseFields({ id: 2, branch_id: 2 })]);
      const { data, total } = await supportTicketRepository.findFiltered({ branch_id: 1 }, { skip: 0, limit: 20 });
      expect(total).toBe(1);
      expect(data[0].id).toBe(1);
    });

    it('returns null branch id for an unknown ticket', async () => {
      expect(await supportTicketRepository.findBranchIdByTicketId(999)).toBeNull();
    });

    it('returns the branch id for a known ticket', async () => {
      await SupportTicket.create(baseFields());
      expect(await supportTicketRepository.findBranchIdByTicketId(1)).toBe(1);
    });
  });

  describe('create / updateFields', () => {
    it('creates a ticket', async () => {
      const created = await supportTicketRepository.create(baseFields());
      expect(created.status).toBe('OPEN');
      expect(created.category).toBe('GENERAL');
    });

    it('updates fields', async () => {
      await SupportTicket.create(baseFields());
      const updated = await supportTicketRepository.updateFields(1, { subject: 'Updated subject' });
      expect(updated.subject).toBe('Updated subject');
    });
  });

  describe('claim', () => {
    it('only claims an OPEN ticket', async () => {
      await SupportTicket.create(baseFields({ status: 'IN_PROGRESS' }));
      expect(await supportTicketRepository.claim(1, { employeeId: 5 })).toBeNull();
    });

    it('moves OPEN -> IN_PROGRESS and assigns the claimant', async () => {
      await SupportTicket.create(baseFields());
      const updated = await supportTicketRepository.claim(1, { employeeId: 5 });
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.assigned_employee_id).toBe(5);
    });
  });

  describe('assign', () => {
    it('allows re-assigning from IN_PROGRESS to a different employee', async () => {
      await SupportTicket.create(baseFields({ status: 'IN_PROGRESS', assigned_employee_id: 5 }));
      const updated = await supportTicketRepository.assign(1, { employeeId: 6, assignedBy: 42 });
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.assigned_employee_id).toBe(6);
    });

    it('refuses to assign a CLOSED ticket', async () => {
      await SupportTicket.create(baseFields({ status: 'CLOSED' }));
      expect(await supportTicketRepository.assign(1, { employeeId: 6, assignedBy: 42 })).toBeNull();
    });
  });

  describe('resolve / close', () => {
    it('moves IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
      await SupportTicket.create(baseFields({ status: 'IN_PROGRESS' }));
      const resolved = await supportTicketRepository.resolve(1, { resolutionNote: 'Fixed' });
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolution_note).toBe('Fixed');

      const closed = await supportTicketRepository.close(1, { closedBy: 42 });
      expect(closed.status).toBe('CLOSED');
      expect(closed.closed_by).toBe(42);
    });

    it('refuses to resolve a ticket that is not IN_PROGRESS', async () => {
      await SupportTicket.create(baseFields());
      expect(await supportTicketRepository.resolve(1, {})).toBeNull();
    });

    it('refuses to close a ticket that is not RESOLVED', async () => {
      await SupportTicket.create(baseFields());
      expect(await supportTicketRepository.close(1, { closedBy: 42 })).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the ticket', async () => {
      await SupportTicket.create(baseFields());
      await supportTicketRepository.remove(1);
      expect(await SupportTicket.findOne({ id: 1 })).toBeNull();
    });
  });
});
