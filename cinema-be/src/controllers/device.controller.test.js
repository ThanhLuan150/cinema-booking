const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const deviceController = require('./device.controller');
const Device = require('../models/Device');
const Entrance = require('../models/Entrance');
const CheckinLog = require('../models/CheckinLog');
const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Payment = require('../models/Payment');
const { hashDeviceKey } = require('../utils/deviceKey');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function dateAt(hoursFromNow) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    movie_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time_begin: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedDevice(overrides = {}) {
  return Device.create({
    id: 1, device_id: 'SCN-1', name: 'Scanner', branch_id: 1, api_key_hash: 'x', status: 'ACTIVE', ...overrides,
  });
}

// A fully valid, checkinable ticket in branch `cinemaId`, reachable by qr_token 'TCK-1'.
async function seedCheckinableTicket({ cinemaId = 1, overrides = {} } = {}) {
  const { movie_date, time_begin } = dateAt(0.5);
  await Room.create({ id: 1, cinema_id: cinemaId, name: 'Room 1', code: 'R1', status: 'ACTIVE' });
  await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date, time_begin, time_end: '23:59', price: 1, status: 'ACTIVE' });
  await Movie.create({ id: 1, name: 'Movie', premiere_date: '2026-01-01', duration: 120 });
  await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
  await Payment.create({ id: 1, code: 'ABC', booking_id: 1, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 1, status: 'PAID' });
  await Invoice.create({
    id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1, status: 1,
    ticket_status: 'ISSUED', qr_token: 'TCK-1', ...overrides,
  });
}

describe('device.controller', () => {
  describe('create', () => {
    it('rejects missing device_id/name', async () => {
      const res = mockRes();
      await deviceController.create({ body: {}, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a duplicate device_id', async () => {
      await seedDevice();
      const res = mockRes();
      await deviceController.create({ body: { device_id: 'SCN-1', name: 'x' }, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DEVICE_ID_TAKEN' }));
    });

    it('rejects an entrance from another branch', async () => {
      await Entrance.create({ id: 5, branch_id: 2, name: 'Other branch gate' });
      const res = mockRes();
      await deviceController.create({ body: { device_id: 'SCN-2', name: 'x', entrance_id: 5 }, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ENTRANCE_BRANCH_MISMATCH' }));
    });

    it('creates a device and returns the api_key exactly once', async () => {
      const res = mockRes();
      await deviceController.create({ body: { device_id: 'SCN-9', name: 'Lobby' }, branchId: 3 }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const body = res.json.mock.calls[0][0];
      expect(body.api_key).toMatch(/^DEV-/);
      expect(body.api_key_hash).toBeUndefined();
      expect(body.branch_id).toBe(3);

      const stored = await Device.findOne({ device_id: 'SCN-9' });
      expect(stored.api_key_hash).toBe(hashDeviceKey(body.api_key));
    });
  });

  describe('rotateKey', () => {
    it('replaces the stored hash and returns a fresh key', async () => {
      await seedDevice({ api_key_hash: hashDeviceKey('DEV-old') });
      const res = mockRes();
      await deviceController.rotateKey({ params: { id: 1 } }, res);
      const { api_key } = res.json.mock.calls[0][0];
      expect(api_key).toMatch(/^DEV-/);
      const stored = await Device.findOne({ id: 1 });
      expect(stored.api_key_hash).toBe(hashDeviceKey(api_key));
      expect(stored.api_key_hash).not.toBe(hashDeviceKey('DEV-old'));
    });
  });

  describe('update', () => {
    it('rejects an entrance from another branch', async () => {
      await seedDevice();
      await Entrance.create({ id: 5, branch_id: 2, name: 'Other' });
      const res = mockRes();
      await deviceController.update({ params: { id: 1 }, body: { entrance_id: 5 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates name, status and detaches the entrance with entrance_id null', async () => {
      await seedDevice({ entrance_id: 9 });
      const res = mockRes();
      await deviceController.update({ params: { id: 1 }, body: { name: 'New', status: 'INACTIVE', entrance_id: null } }, res);
      const updated = res.json.mock.calls[0][0];
      expect(updated.name).toBe('New');
      expect(updated.status).toBe('INACTIVE');
      expect(updated.entrance_id).toBeNull();
    });
  });

  describe('checkin (device-authenticated)', () => {
    const device = () => ({ id: 1, branch_id: 1, entrance_id: 7 });

    it('rejects a missing qr_token without logging', async () => {
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(await CheckinLog.countDocuments()).toBe(0);
    });

    it('404s an unknown token and logs a REJECTED row', async () => {
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: { qr_token: 'TCK-nope' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
      const log = await CheckinLog.findOne();
      expect(log.result).toBe('REJECTED');
      expect(log.reason).toBe('TICKET_NOT_FOUND');
      expect(log.device_id).toBe(1);
      expect(log.entrance_id).toBe(7);
    });

    it('refuses a ticket from another branch (the ticket-23 security rule) and logs BRANCH_MISMATCH', async () => {
      await seedCheckinableTicket({ cinemaId: 2 }); // ticket belongs to branch 2
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, res); // scanner is branch 1
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_MISMATCH' }));
      const log = await CheckinLog.findOne();
      expect(log.result).toBe('REJECTED');
      expect(log.reason).toBe('BRANCH_MISMATCH');
      const invoice = await Invoice.findOne({ id: 1 });
      expect(invoice.ticket_status).toBe('ISSUED'); // untouched
    });

    it('rejects a ticket with no PAID payment', async () => {
      await seedCheckinableTicket({ cinemaId: 1 });
      await Payment.updateOne({ id: 1 }, { status: 'PENDING' });
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAYMENT_NOT_PAID' }));
    });

    it('rejects an already-used ticket', async () => {
      await seedCheckinableTicket({ cinemaId: 1, overrides: { ticket_status: 'USED' } });
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ALREADY_CHECKED_IN' }));
    });

    it('admits a valid same-branch ticket, flips it to USED and logs SUCCESS', async () => {
      await seedCheckinableTicket({ cinemaId: 1 });
      const res = mockRes();
      await deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ checked_in: true, invoice_id: 1 }));
      const invoice = await Invoice.findOne({ id: 1 });
      expect(invoice.ticket_status).toBe('USED');
      expect(invoice.checkin_branch_id).toBe(1);
      const log = await CheckinLog.findOne({ result: 'SUCCESS' });
      expect(log.invoice_id).toBe(1);
      expect(log.branch_id).toBe(1);
    });

    it('is atomic: a second concurrent scan of the same ticket loses', async () => {
      await seedCheckinableTicket({ cinemaId: 1 });
      const [a, b] = [mockRes(), mockRes()];
      await Promise.all([
        deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, a),
        deviceController.checkin({ device: device(), body: { qr_token: 'TCK-1' } }, b),
      ]);
      const bodies = [a, b].map((r) => r.json.mock.calls[0][0] || {});
      expect(bodies.filter((x) => x.checked_in === true)).toHaveLength(1);
      expect(bodies.filter((x) => x.code === 'ALREADY_CHECKED_IN')).toHaveLength(1);
      expect(await Invoice.countDocuments({ id: 1, ticket_status: 'USED' })).toBe(1);
    });
  });
});
