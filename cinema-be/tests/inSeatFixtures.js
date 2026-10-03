// Shared world for the Ticket 49 (In-Seat F&B Ordering) HTTP suites.
const seedRbac = require('../src/seed/seedRbac');
const seedPositions = require('../src/seed/seedPositions');
const Account = require('../src/models/Account');
const Booking = require('../src/models/Booking');
const Branch = require('../src/models/Branch');
const Combo = require('../src/models/Combo');
const Employee = require('../src/models/Employee');
const Invoice = require('../src/models/Invoice');
const Movie = require('../src/models/Movie');
const Position = require('../src/models/Position');
const Room = require('../src/models/Room');
const Schedule = require('../src/models/Schedule');
const Ticket = require('../src/models/Ticket');
const { signSeatQr } = require('../src/utils/seatQr');
const { authHeader } = require('./routeTestUtils');

const MINUTE = 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

// movie_date/time_begin/time_end from LOCAL getters for every half, relative to the real clock
// (the server reads them back as local time).
function localShowtime(startsInMinutes, durationMinutes = 120) {
  const start = new Date(Date.now() + startsInMinutes * MINUTE);
  const end = new Date(start.getTime() + durationMinutes * MINUTE);
  return {
    movie_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time_begin: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    time_end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

const ID = {
  SUPER_ADMIN: 1,
  OWNER_1: 42, // Branch Admin of branch 1
  OWNER_2: 43, // Branch Admin of branch 2
  LAN: 10, // customer: seat E7 of showtime 7
  MINH: 20, // customer: seat E8 of showtime 7
  NO_TICKET: 30, // customer without any ticket
  FNB_1: 8, // F&B Staff at branch 1
  FNB_2: 9, // F&B Staff at branch 2
  BRANCH_1: 1,
  BRANCH_2: 2,
  ROOM: 5, // Hall 3, branch 1
  OTHER_ROOM: 6, // Hall 4, branch 1
  BRANCH_2_ROOM: 9,
  SHOWTIME: 7, // now-ish, room 5
  LATER_SHOWTIME: 8, // later the same day, same room 5
  BRANCH_2_SHOWTIME: 9,
  LAN_BOOKING: 100,
  LAN_INVOICE: 1000,
  MINH_BOOKING: 200,
  MINH_INVOICE: 2000,
  POPCORN: 1, // 65,000 FOOD, branch 1
  COKE: 2, // 30,000 BEVERAGE, branch 1
  RETIRED: 3, // inactive, branch 1
  NACHOS: 4, // branch 2
};

const as = (role, accountId) => authHeader({ role, accountId });
const auth = {
  lan: () => as(1, ID.LAN),
  minh: () => as(1, ID.MINH),
  noTicket: () => as(1, ID.NO_TICKET),
  owner1: () => as(2, ID.OWNER_1),
  owner2: () => as(2, ID.OWNER_2),
  fnb1: () => as(3, ID.FNB_1),
  fnb2: () => as(3, ID.FNB_2),
  superAdmin: () => as(0, ID.SUPER_ADMIN),
};

function qrFor({ scheduleId = ID.SHOWTIME, seatCode = 'E7', roomId = ID.ROOM, branchId = ID.BRANCH_1 } = {}) {
  return signSeatQr({ branchId, roomId, scheduleId, seatCode });
}

async function staff(accountId, branchId, positionCode, id) {
  const position = await Position.findOne({ code: positionCode });
  await Employee.create({
    id,
    user_id: accountId,
    branch_id: branchId,
    employee_code: `E${id}`,
    position_id: position.id,
    status: 1,
  });
}

// `showtimeStartsInMinutes` places showtime 7 relative to now: 30 (default) = ordering is open.
async function seedInSeatWorld({ showtimeStartsInMinutes = 30 } = {}) {
  await seedRbac();
  await seedPositions();

  await Branch.create([
    { id: ID.BRANCH_1, company_id: 1, owner_id: ID.OWNER_1, name: 'CineNova Central', code: 'CEN' },
    { id: ID.BRANCH_2, company_id: 1, owner_id: ID.OWNER_2, name: 'CineNova Riverside', code: 'RIV' },
  ]);
  await Account.create([
    { id: ID.LAN, email: 'lan@example.com', password: 'x', name: 'Lan Nguyen', role: 1 },
    { id: ID.MINH, email: 'minh@example.com', password: 'x', name: 'Minh Tran', role: 1 },
    { id: ID.NO_TICKET, email: 'walkin@example.com', password: 'x', name: 'Walk In', role: 1 },
  ]);
  await Movie.create({ id: 1, name: 'Dune: Part Three', premiere_date: '2026-01-01', duration: 120 });
  await Room.create([
    { id: ID.ROOM, cinema_id: ID.BRANCH_1, name: 'Hall 3' },
    { id: ID.OTHER_ROOM, cinema_id: ID.BRANCH_1, name: 'Hall 4' },
    { id: ID.BRANCH_2_ROOM, cinema_id: ID.BRANCH_2, name: 'River Hall' },
  ]);
  await Schedule.create([
    { id: ID.SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: 90000, ...localShowtime(showtimeStartsInMinutes) },
    { id: ID.LATER_SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: 90000, ...localShowtime(360) },
    { id: ID.BRANCH_2_SHOWTIME, movie_id: 1, room_id: ID.BRANCH_2_ROOM, cinema_id: ID.BRANCH_2, price: 90000, ...localShowtime(30) },
  ]);
  await Ticket.create([
    { id: 1, schedule_id: ID.SHOWTIME, seat_index: 38, seat_code: 'E7', status: Ticket.STATUS.BOOKED },
    { id: 2, schedule_id: ID.SHOWTIME, seat_index: 39, seat_code: 'E8', status: Ticket.STATUS.BOOKED },
    { id: 3, schedule_id: ID.SHOWTIME, seat_index: 40, seat_code: 'E9', status: Ticket.STATUS.AVAILABLE },
    { id: 11, schedule_id: ID.LATER_SHOWTIME, seat_index: 38, seat_code: 'E7', status: Ticket.STATUS.AVAILABLE },
    { id: 21, schedule_id: ID.BRANCH_2_SHOWTIME, seat_index: 0, seat_code: 'A1', status: Ticket.STATUS.AVAILABLE },
  ]);
  await Booking.create([
    {
      id: ID.LAN_BOOKING,
      code: 'BK-100',
      account_id: ID.LAN,
      schedule_id: ID.SHOWTIME,
      branch_id: ID.BRANCH_1,
      ticket_ids: [1],
      seat_total: 90000,
      total_price: 90000,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
    },
    {
      id: ID.MINH_BOOKING,
      code: 'BK-200',
      account_id: ID.MINH,
      schedule_id: ID.SHOWTIME,
      branch_id: ID.BRANCH_1,
      ticket_ids: [2],
      seat_total: 90000,
      total_price: 90000,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
    },
  ]);
  await Invoice.create([
    {
      id: ID.LAN_INVOICE,
      booking_id: ID.LAN_BOOKING,
      ticket_id: 1,
      account_id: ID.LAN,
      code: 'BK-100',
      total_price: 90000,
      qr_token: 'TCK-lan',
      ticket_status: Invoice.TICKET_STATUS.ISSUED,
      issued_at: new Date(),
    },
    {
      id: ID.MINH_INVOICE,
      booking_id: ID.MINH_BOOKING,
      ticket_id: 2,
      account_id: ID.MINH,
      code: 'BK-200',
      total_price: 90000,
      qr_token: 'TCK-minh',
      ticket_status: Invoice.TICKET_STATUS.ISSUED,
      issued_at: new Date(),
    },
  ]);
  await Combo.create([
    { id: ID.POPCORN, cinema_id: ID.BRANCH_1, name: 'Large Popcorn', price: 65000, type: 'FOOD', active: true },
    { id: ID.COKE, cinema_id: ID.BRANCH_1, name: 'Coke', price: 30000, type: 'BEVERAGE', active: true },
    { id: ID.RETIRED, cinema_id: ID.BRANCH_1, name: 'Old Hotdog', price: 40000, type: 'FOOD', active: false },
    { id: ID.NACHOS, cinema_id: ID.BRANCH_2, name: 'Nachos', price: 60000, type: 'FOOD', active: true },
  ]);
  await staff(ID.FNB_1, ID.BRANCH_1, 'FNB_STAFF', 1);
  await staff(ID.FNB_2, ID.BRANCH_2, 'FNB_STAFF', 2);
}

module.exports = { MINUTE, ID, auth, as, qrFor, localShowtime, seedInSeatWorld };
