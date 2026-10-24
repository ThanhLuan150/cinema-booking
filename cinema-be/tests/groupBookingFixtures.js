const seedRbac = require('../src/seed/seedRbac');
const Account = require('../src/models/Account');
const Branch = require('../src/models/Branch');
const Combo = require('../src/models/Combo');
const Movie = require('../src/models/Movie');
const Promotion = require('../src/models/Promotion');
const Room = require('../src/models/Room');
const Schedule = require('../src/models/Schedule');
const Seat = require('../src/models/Seat');
const Ticket = require('../src/models/Ticket');
const { localShowtime } = require('./inSeatFixtures');
const { authHeader } = require('./routeTestUtils');

const ID = {
  SUPER_ADMIN: 1,
  OWNER_1: 42,
  OWNER_2: 43,
  LAN: 10, // the group organiser
  MINH: 20, // another customer
  HOA: 30, // a third customer
  BRANCH_1: 1,
  BRANCH_2: 2,
  ROOM: 5,
  BRANCH_2_ROOM: 9,
  SHOWTIME: 7, // tomorrow-ish, room 5, 20 seats
  OTHER_SHOWTIME: 8, // same room, later
  BRANCH_2_SHOWTIME: 9,
  POPCORN: 1, // 50,000
  DRINK: 2, // 30,000
  RETIRED: 3, // inactive
  NACHOS: 4, // branch 2
};

const PRICE = { REGULAR: 100000, VIP: 120000 }; // VIP = base x 1.2 (utils/seatPricing)

const as = (role, accountId) => authHeader({ role, accountId });
const auth = {
  lan: () => as(1, ID.LAN),
  minh: () => as(1, ID.MINH),
  hoa: () => as(1, ID.HOA),
  owner1: () => as(2, ID.OWNER_1),
  owner2: () => as(2, ID.OWNER_2),
  superAdmin: () => as(0, ID.SUPER_ADMIN),
};

// Ticket ids on showtime 7: A1..A10 = 1..10, B1..B10 = 11..20. Showtime 8 = 101..120, branch 2 = 201..205.
const seatId = (code) => (code[0] === 'A' ? 0 : 10) + Number(code.slice(1));
const seatIds = (...codes) => codes.map(seatId);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function grid(scheduleId, idOffset, count = 20) {
  return range(1, count).map((n) => {
    const row = n <= 10 ? 'A' : 'B';
    const number = n <= 10 ? n : n - 10;
    return {
      id: idOffset + n,
      schedule_id: scheduleId,
      seat_index: n - 1,
      seat_code: `${row}${number}`,
      seat_type: row === 'B' ? 1 : 0,
      status: Ticket.STATUS.AVAILABLE,
    };
  });
}

async function seedGroupWorld({ showtimeStartsInMinutes = 24 * 60, withRbac = true } = {}) {
  if (withRbac) await seedRbac();
  await Branch.create([
    { id: ID.BRANCH_1, company_id: 1, owner_id: ID.OWNER_1, name: 'CineNova Central', code: 'CEN' },
    { id: ID.BRANCH_2, company_id: 1, owner_id: ID.OWNER_2, name: 'CineNova Riverside', code: 'RIV' },
  ]);
  await Account.create([
    { id: ID.LAN, email: 'lan@example.com', password: 'x', name: 'Lan Nguyen', role: 1 },
    { id: ID.MINH, email: 'minh@example.com', password: 'x', name: 'Minh Tran', role: 1 },
    { id: ID.HOA, email: 'hoa@example.com', password: 'x', name: 'Hoa Le', role: 1 },
  ]);
  await Movie.create({ id: 1, name: 'Dune: Part Three', premiere_date: '2026-01-01', duration: 120 });
  await Room.create([
    { id: ID.ROOM, cinema_id: ID.BRANCH_1, name: 'Hall 3' },
    { id: ID.BRANCH_2_ROOM, cinema_id: ID.BRANCH_2, name: 'River Hall' },
  ]);
  await Schedule.create([
    { id: ID.SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: PRICE.REGULAR, ...localShowtime(showtimeStartsInMinutes) },
    { id: ID.OTHER_SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: PRICE.REGULAR, ...localShowtime(showtimeStartsInMinutes + 300) },
    { id: ID.BRANCH_2_SHOWTIME, movie_id: 1, room_id: ID.BRANCH_2_ROOM, cinema_id: ID.BRANCH_2, price: PRICE.REGULAR, ...localShowtime(showtimeStartsInMinutes) },
  ]);
  await Seat.create(
    grid(ID.SHOWTIME, 0).map((t) => ({ id: t.id, room_id: ID.ROOM, seat_code: t.seat_code, seat_type: t.seat_type, status: 'ACTIVE' })),
  );
  await Ticket.create([...grid(ID.SHOWTIME, 0), ...grid(ID.OTHER_SHOWTIME, 100), ...grid(ID.BRANCH_2_SHOWTIME, 200, 5)]);
  await Combo.create([
    { id: ID.POPCORN, cinema_id: ID.BRANCH_1, name: 'Popcorn', price: 50000, type: 'FOOD', active: true },
    { id: ID.DRINK, cinema_id: ID.BRANCH_1, name: 'Drink', price: 30000, type: 'BEVERAGE', active: true },
    { id: ID.RETIRED, cinema_id: ID.BRANCH_1, name: 'Old Hotdog', price: 40000, type: 'FOOD', active: false },
    { id: ID.NACHOS, cinema_id: ID.BRANCH_2, name: 'Nachos', price: 60000, type: 'FOOD', active: true },
  ]);
}

const DAY = 24 * 60 * 60 * 1000;
function promotion(overrides = {}) {
  return {
    name: 'Promo',
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    start_at: new Date(Date.now() - DAY),
    end_at: new Date(Date.now() + 7 * DAY),
    ...overrides,
  };
}

// GROUP10: 10% off 10+ tickets. GROUP5: 5% off 5+ tickets. SUMMER: an ordinary code (no ticket minimum).
async function seedGroupPromotions() {
  await Promotion.create([
    promotion({ id: 1, code: 'GROUP10', name: 'Group of 10', discount_value: 10, min_tickets: 10 }),
    promotion({ id: 2, code: 'GROUP5', name: 'Group of 5', discount_value: 5, min_tickets: 5 }),
    promotion({ id: 3, code: 'SUMMER', name: 'Summer', discount_type: 'FIXED_AMOUNT', discount_value: 20000 }),
  ]);
}

module.exports = { ID, PRICE, auth, as, seatId, seatIds, range, seedGroupWorld, seedGroupPromotions, promotion };
