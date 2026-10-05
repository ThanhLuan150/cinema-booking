// Shared world for the Ticket 51 (Showtime Waitlist) suites: one showtime, sold out.
const Account = require('../src/models/Account');
const Booking = require('../src/models/Booking');
const Branch = require('../src/models/Branch');
const Movie = require('../src/models/Movie');
const Room = require('../src/models/Room');
const Schedule = require('../src/models/Schedule');
const Seat = require('../src/models/Seat');
const Ticket = require('../src/models/Ticket');
const { localShowtime } = require('./inSeatFixtures');

const ID = {
  BRANCH: 1,
  OWNER: 42,
  ROOM: 5,
  MOVIE: 1,
  SHOWTIME: 7,
  // Waitlist customers: CUSTOMER(0), CUSTOMER(1), ...
  CUSTOMER_BASE: 10,
  // Whoever bought seat i (1-based) holds booking BOOKING_BASE + i.
  HOLDER_BASE: 500,
  BOOKING_BASE: 100,
};
const customer = (n) => ID.CUSTOMER_BASE + n;

// `seats` sellable seats A1..An, every one sold (one PAID booking per seat), plus an out-of-service
// seat X1 whose grid Ticket stays AVAILABLE — exactly the shape a disabled seat has in production.
async function seedSoldOutShowtime({ seats = 6, startsInMinutes = 180, customers = 10 } = {}) {
  await Branch.create({ id: ID.BRANCH, company_id: 1, owner_id: ID.OWNER, name: 'CineNova Central', code: 'CEN' });
  await Movie.create({ id: ID.MOVIE, name: 'Dune: Part Three', premiere_date: '2026-01-01', duration: 120 });
  await Room.create({ id: ID.ROOM, cinema_id: ID.BRANCH, name: 'Hall 3' });
  await Schedule.create({
    id: ID.SHOWTIME,
    movie_id: ID.MOVIE,
    room_id: ID.ROOM,
    cinema_id: ID.BRANCH,
    price: 90000,
    ...localShowtime(startsInMinutes),
  });

  const seatRows = [];
  const ticketRows = [];
  const bookingRows = [];
  for (let i = 1; i <= seats; i += 1) {
    seatRows.push({ id: i, room_id: ID.ROOM, row: 'A', number: i, seat_code: `A${i}` });
    ticketRows.push({ id: i, schedule_id: ID.SHOWTIME, seat_index: i, seat_code: `A${i}`, status: Ticket.STATUS.BOOKED });
    bookingRows.push({
      id: ID.BOOKING_BASE + i,
      code: `BK-SOLD-${i}`,
      account_id: ID.HOLDER_BASE + i,
      schedule_id: ID.SHOWTIME,
      branch_id: ID.BRANCH,
      ticket_ids: [i],
      total_price: 90000,
      status: Booking.STATUS.PAID,
      paid_at: new Date(Date.now() - 60 * 60 * 1000),
    });
  }
  seatRows.push({ id: 99, room_id: ID.ROOM, row: 'X', number: 1, seat_code: 'X1', status: 'DISABLED' });
  ticketRows.push({ id: 99, schedule_id: ID.SHOWTIME, seat_index: 0, seat_code: 'X1', status: Ticket.STATUS.AVAILABLE });

  await Seat.create(seatRows);
  await Ticket.create(ticketRows);
  await Booking.create(bookingRows);
  await Account.create(
    Array.from({ length: customers }, (_, n) => ({
      id: customer(n),
      email: `customer${n}@example.com`,
      password: 'x',
      name: `Customer ${n}`,
      role: 1,
    })),
  );
}

const soldBooking = (seatNumber) => Booking.findOne({ id: ID.BOOKING_BASE + seatNumber });

module.exports = { ID, customer, seedSoldOutShowtime, soldBooking };
