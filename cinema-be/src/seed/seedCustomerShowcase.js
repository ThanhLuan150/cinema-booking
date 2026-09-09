/**
 * Populates ONE customer account with a coherent set of data across every screen in the
 * account area (My Membership, My Gift Cards, My Bookings, My Tickets, Payment History,
 * My Refunds, Notifications) so the profile menu is not a wall of empty states in a demo.
 *
 *   node src/seed/seedCustomerShowcase.js                       # default e-mail below
 *   node src/seed/seedCustomerShowcase.js someone@example.com   # a specific account
 *   node src/seed/seedCustomerShowcase.js someone@example.com --force   # wipe & re-seed
 *
 * Safe to re-run: without --force it no-ops if the account already has showcase rows.
 * Requires an existing Movie + Room (run `node src/seed/seedMovies.js` first) and the
 * loyalty tiers (seeded here via seedLoyalty).
 */
require('dotenv').config();

const connectDB = require('../config/db');
const seedLoyalty = require('./seedLoyalty');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Refund = require('../models/Refund');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const PointsTransaction = require('../models/PointsTransaction');
const Notification = require('../models/Notification');

const DEFAULT_EMAIL = 'letruongthanhluan1505@gmail.com';
const ID_BASE = 950000;
let seq = 0;
const nid = () => ID_BASE + (seq += 1);

const SEAT_PRICE = 90000;
const day = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};
const isoDay = (offsetDays) => day(offsetDays).toISOString().slice(0, 10);

async function resolveTargets() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const email = (args.find((a) => !a.startsWith('--')) || DEFAULT_EMAIL).toLowerCase();
  return { email, force };
}

async function pickStage() {
  const movie = await Movie.findOne({ status: { $ne: 'INACTIVE' } }).sort({ id: 1 });
  const room = await Room.findOne().sort({ id: 1 });
  if (!movie || !room) {
    throw new Error('Need at least one Movie and one Room — run `node src/seed/seedMovies.js` first.');
  }
  const branch = await Branch.findOne({ id: room.cinema_id });
  return { movie, room, branch, branchId: room.cinema_id };
}

async function clearShowcase(accountId) {
  const codeRe = new RegExp(`^SHOW-${accountId}-`);
  const bookings = await Booking.find({ code: codeRe });
  const bookingIds = bookings.map((b) => b.id);
  const scheduleIds = [...new Set(bookings.map((b) => b.schedule_id))];
  const cards = await GiftCard.find({ code: codeRe });
  const cardIds = cards.map((c) => c.id);
  await Promise.all([
    Booking.deleteMany({ code: codeRe }),
    Payment.deleteMany({ code: codeRe }),
    Invoice.deleteMany({ code: codeRe }),
    Refund.deleteMany({ booking_id: { $in: bookingIds } }),
    Ticket.deleteMany({ schedule_id: { $in: scheduleIds } }),
    Schedule.deleteMany({ id: { $in: scheduleIds } }),
    PointsTransaction.deleteMany({ account_id: accountId, description: /^\[showcase]/ }),
    GiftCardTransaction.deleteMany({ gift_card_id: { $in: cardIds } }),
    GiftCard.deleteMany({ code: codeRe }),
    Notification.deleteMany({ dedupe_key: codeRe }),
  ]);
}

async function makeBooking({ account, stage, seatStart, seatCount, status, offsetDays, ticketStatus }) {
  const schedule = await Schedule.create({
    id: nid(),
    movie_id: stage.movie.id,
    room_id: stage.room.id,
    cinema_id: stage.branchId,
    movie_date: isoDay(offsetDays),
    time_begin: '19:30',
    time_end: '21:30',
    price: SEAT_PRICE,
    status: 'ACTIVE',
  });

  const seats = [];
  for (let i = 0; i < seatCount; i += 1) {
    const seatIndex = seatStart + i;
    const ticketId = nid();
    await Ticket.create({
      id: ticketId,
      schedule_id: schedule.id,
      seat_index: seatIndex,
      seat_code: `H${seatIndex + 1}`,
      status: 0,
    });
    seats.push({ ticketId, seatCode: `H${seatIndex + 1}` });
  }

  const total = seatCount * SEAT_PRICE;
  const code = `SHOW-${account.id}-${schedule.id}`;
  const paidAt = day(offsetDays - 1);
  const cancelled = status === 'CANCELLED';

  const booking = await Booking.create({
    id: nid(),
    code,
    account_id: account.id,
    schedule_id: schedule.id,
    branch_id: stage.branchId,
    ticket_ids: seats.map((s) => s.ticketId),
    seat_total: total,
    total_price: total,
    status,
    paid_at: paidAt,
    cancelled_at: cancelled ? day(offsetDays) : null,
    cancel_reason: cancelled ? 'Kế hoạch thay đổi' : null,
  });

  const payment = await Payment.create({
    id: nid(),
    code,
    booking_id: booking.id,
    account_id: account.id,
    branch_id: stage.branchId,
    type: 'ONLINE',
    method: 'MOMO',
    amount: total,
    status: cancelled ? 'REFUNDED' : 'PAID',
    paid_at: paidAt,
    refunded_at: cancelled ? day(offsetDays) : null,
    refund_reason: cancelled ? 'Huỷ vé theo yêu cầu khách hàng' : null,
  });

  for (const seat of seats) {
    const invoiceId = nid();
    const used = ticketStatus === 'USED';
    await Invoice.create({
      id: invoiceId,
      booking_id: booking.id,
      ticket_id: seat.ticketId,
      account_id: account.id,
      code,
      total_price: Math.round(total / seatCount),
      status: cancelled ? 2 : 1,
      ticket_status: ticketStatus,
      checked_in: used,
      checked_in_at: used ? day(offsetDays) : null,
      checkin_branch_id: used ? stage.branchId : null,
      issued_at: paidAt,
      qr_token: `SHOW-QR-${invoiceId}`,
    });
  }

  return { booking, payment, schedule, seats, total };
}

async function run() {
  await connectDB();
  const { email, force } = await resolveTargets();

  const account = await Account.findOne({ email });
  if (!account) {
    console.error(`No account with e-mail "${email}". Register it first, then re-run.`);
    process.exit(1);
  }

  await seedLoyalty();
  const stage = await pickStage();

  const alreadySeeded = await Booking.findOne({ code: new RegExp(`^SHOW-${account.id}-`) });
  if (alreadySeeded && !force) {
    console.log(`Account #${account.id} (${email}) already has showcase data — pass --force to rebuild.`);
    process.exit(0);
  }
  if (force) {
    await clearShowcase(account.id);
    console.log('Cleared previous showcase rows.');
  }

  // --- Bookings / payments / invoices / tickets ---------------------------------
  const completed = await makeBooking({
    account, stage, seatStart: 40, seatCount: 2, status: 'COMPLETED', offsetDays: -12, ticketStatus: 'USED',
  });
  const upcoming = await makeBooking({
    account, stage, seatStart: 42, seatCount: 2, status: 'PAID', offsetDays: 6, ticketStatus: 'ISSUED',
  });
  const cancelled = await makeBooking({
    account, stage, seatStart: 44, seatCount: 1, status: 'CANCELLED', offsetDays: 4, ticketStatus: 'REFUNDED',
  });

  // --- Refund for the cancelled booking ---------------------------------------
  await Refund.create({
    id: nid(),
    booking_id: cancelled.booking.id,
    payment_id: cancelled.payment.id,
    account_id: account.id,
    branch_id: stage.branchId,
    amount: Math.round(cancelled.total * 0.8),
    policy_percent: 80,
    reason: 'Không sắp xếp được lịch xem',
    status: 'COMPLETED',
    requested_at: day(3),
    decided_at: day(3),
    processed_at: day(3),
    completed_at: day(4),
  });

  // --- Loyalty: points ledger + tier -----------------------------------------
  let balance = 0;
  const addPoints = async (type, points, description, bookingId = null) => {
    balance += points;
    await PointsTransaction.create({
      id: nid(),
      account_id: account.id,
      type,
      points,
      remaining_points: points > 0 ? points : 0,
      balance_after: balance,
      booking_id: bookingId,
      description: `[showcase] ${description}`,
      expires_at: points > 0 ? day(365) : null,
    });
  };
  await addPoints('EARN', 1200, 'Đặt vé xem phim', completed.booking.id);
  await addPoints('EARN', 1200, 'Đặt vé xem phim', upcoming.booking.id);
  await addPoints('ADJUST', 500, 'Điểm thưởng sinh nhật');
  await addPoints('REDEEM', -400, 'Đổi điểm lấy ưu đãi bắp nước');

  const lifetime = 1200 + 1200 + 500;
  account.points_balance = balance;
  account.lifetime_points = Math.max(account.lifetime_points || 0, lifetime);
  account.membership_level = 'SILVER';
  await account.save();

  // --- Gift cards -----------------------------------------------------------
  const fullCard = await GiftCard.create({
    id: nid(),
    code: `SHOW-${account.id}-FULL`,
    initial_balance: 500000,
    remaining_balance: 500000,
    currency: 'VND',
    owner_account_id: account.id,
    redeemed_at: day(-20),
    expires_at: day(300),
    status: 'ACTIVE',
  });
  await GiftCardTransaction.create({
    id: nid(),
    gift_card_id: fullCard.id,
    account_id: account.id,
    type: 'REDEEM',
    amount: 500000,
    balance_after: 500000,
    reason: '[showcase] Nạp thẻ quà tặng vào tài khoản',
  });

  const partialCard = await GiftCard.create({
    id: nid(),
    code: `SHOW-${account.id}-PART`,
    initial_balance: 300000,
    remaining_balance: 120000,
    currency: 'VND',
    owner_account_id: account.id,
    redeemed_at: day(-40),
    expires_at: day(120),
    status: 'ACTIVE',
  });
  await GiftCardTransaction.create({
    id: nid(),
    gift_card_id: partialCard.id,
    account_id: account.id,
    type: 'REDEEM',
    amount: 300000,
    balance_after: 300000,
    reason: '[showcase] Nạp thẻ quà tặng vào tài khoản',
  });
  await GiftCardTransaction.create({
    id: nid(),
    gift_card_id: partialCard.id,
    account_id: account.id,
    type: 'USE',
    amount: 180000,
    balance_after: 120000,
    booking_id: completed.booking.id,
    reason: '[showcase] Thanh toán vé bằng thẻ quà tặng',
  });

  // --- Notifications feed --------------------------------------------------
  const movieName = stage.movie.name;
  const branchName = stage.branch ? stage.branch.name : 'CineNova';
  const notes = [
    {
      type: 'PAYMENT_SUCCESS',
      title: 'Thanh toán thành công',
      body: `Đơn ${completed.booking.code} đã thanh toán ${completed.total.toLocaleString('vi-VN')}đ.`,
      readOffsetDays: -12,
    },
    {
      type: 'TICKET_ISSUED',
      title: 'Vé của bạn đã sẵn sàng',
      body: `${completed.seats.length} vé xem "${movieName}" tại ${branchName}.`,
      readOffsetDays: -12,
    },
    {
      type: 'BOOKING_CREATED',
      title: 'Đặt vé thành công',
      body: `Đơn ${upcoming.booking.code} cho "${movieName}" đã được tạo.`,
      readOffsetDays: null,
    },
    {
      type: 'SHOWTIME_CHANGED',
      title: 'Suất chiếu thay đổi giờ',
      body: `Suất "${movieName}" ngày ${upcoming.schedule.movie_date} dời sang 19:30.`,
      readOffsetDays: null,
    },
    {
      type: 'BOOKING_CANCELLED',
      title: 'Đơn đặt vé đã huỷ',
      body: `Đơn ${cancelled.booking.code} đã được huỷ theo yêu cầu.`,
      readOffsetDays: null,
    },
    {
      type: 'REFUND_COMPLETED',
      title: 'Hoàn tiền thành công',
      body: `Đã hoàn ${Math.round(cancelled.total * 0.8).toLocaleString('vi-VN')}đ cho đơn ${cancelled.booking.code}.`,
      readOffsetDays: null,
    },
  ];
  for (const [i, n] of notes.entries()) {
    await Notification.create({
      id: nid(),
      account_id: account.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: { movie: movieName, branch: branchName },
      channels: ['IN_APP'],
      status: 'SENT',
      sent_at: day(-3 + i),
      read_at: n.readOffsetDays == null ? null : day(n.readOffsetDays),
      dedupe_key: `SHOW-${account.id}-note-${i}`,
    });
  }

  console.log(
    `Showcase data ready for #${account.id} (${email}): 3 bookings, 5 tickets, 1 refund, ` +
      `4 points entries, 2 gift cards, ${notes.length} notifications. Membership: SILVER.`,
  );
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
