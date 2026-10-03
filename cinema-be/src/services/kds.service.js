const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const {
  KDS_STATUSES,
  ACTIVE_KDS_STATUSES,
  DONE_KDS_STATUSES,
  KDS_TO_ORDER_STATUS,
  ORDER_TO_KDS_STATUS,
  KDS_TIMESTAMP_FIELD,
  KDS_TRANSITIONS,
  toKdsStatus,
  kdsTimestamps,
} = require('../utils/kdsStatus');

const DEFAULT_RECENT_MINUTES = 60;
const MAX_RECENT_MINUTES = 720;
const MAX_BOARD_ORDERS = 200;

function clampRecentMinutes(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RECENT_MINUTES;
  return Math.min(Math.floor(value), MAX_RECENT_MINUTES);
}

// One Mongo clause per requested KDS status. Active statuses are listed whatever their age (an order
// still waiting is exactly what the kitchen must not lose); finished ones only if they finished within
// the last `recentMinutes`, so the "done" lane stays short.
function buildClauses(statuses, since) {
  return statuses.map((status) => {
    const clause = { status: KDS_TO_ORDER_STATUS[status] };
    if (DONE_KDS_STATUSES.includes(status)) clause[KDS_TIMESTAMP_FIELD[status]] = { $gte: since };
    return clause;
  });
}

// Bulk-loads the customer and seat context for a page of orders — one query per collection, however
// many orders are on the board. Only what the kitchen needs to hand the order over: the customer's
// display name (no email/phone), the booking code, its seats, room and showtime.
async function loadContext(orders) {
  const accountIds = [
    ...new Set(orders.map((o) => o.account_id).filter((id) => id !== null && id !== undefined)),
  ];
  const bookingIds = [
    ...new Set(orders.map((o) => o.booking_id).filter((id) => id !== null && id !== undefined)),
  ];

  const [accounts, bookings] = await Promise.all([
    accountIds.length ? Account.find({ id: { $in: accountIds } }, { id: 1, name: 1 }).lean() : [],
    bookingIds.length
      ? Booking.find(
          { id: { $in: bookingIds } },
          { id: 1, code: 1, branch_id: 1, schedule_id: 1, ticket_ids: 1 },
        ).lean()
      : [],
  ]);

  const ticketIds = [...new Set(bookings.flatMap((b) => b.ticket_ids || []))];
  // In-seat orders (Ticket 49) also name the exact seat/room/showtime to deliver to.
  const deliveries = orders.map((o) => o.seat_delivery).filter(Boolean);
  const scheduleIds = [
    ...new Set([...bookings.map((b) => b.schedule_id), ...deliveries.map((d) => d.schedule_id)]),
  ];
  const [tickets, schedules] = await Promise.all([
    ticketIds.length ? Ticket.find({ id: { $in: ticketIds } }, { id: 1, seat_code: 1 }).lean() : [],
    scheduleIds.length
      ? Schedule.find(
          { id: { $in: scheduleIds } },
          { id: 1, room_id: 1, movie_date: 1, time_begin: 1 },
        ).lean()
      : [],
  ]);
  const roomIds = [
    ...new Set([...schedules.map((s) => s.room_id), ...deliveries.map((d) => d.room_id)]),
  ];
  const rooms = roomIds.length
    ? await Room.find({ id: { $in: roomIds } }, { id: 1, name: 1 }).lean()
    : [];

  return {
    accountById: new Map(accounts.map((a) => [a.id, a])),
    bookingById: new Map(bookings.map((b) => [b.id, b])),
    seatByTicketId: new Map(tickets.map((t) => [t.id, t.seat_code])),
    scheduleById: new Map(schedules.map((s) => [s.id, s])),
    roomById: new Map(rooms.map((r) => [r.id, r])),
  };
}

function presentBooking(order, context) {
  const booking = order.booking_id ? context.bookingById.get(order.booking_id) : null;
  // A booking of another branch would only happen through corrupt data; never show its seats here.
  if (!booking || booking.branch_id !== order.branch_id) return null;
  const schedule = context.scheduleById.get(booking.schedule_id);
  const room = schedule ? context.roomById.get(schedule.room_id) : null;
  const seats = (booking.ticket_ids || [])
    .map((id) => context.seatByTicketId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return {
    id: booking.id,
    code: booking.code,
    seats,
    room: room ? room.name : null,
    showtime: schedule ? { date: schedule.movie_date, time: schedule.time_begin } : null,
  };
}

// In-seat orders only: where staff walk the finished order to. Taken from the order itself (the seat
// validated against the customer's ticket when it was placed), not from the booking — a booking may
// hold several seats, but the food goes to the one whose QR was scanned.
function presentDelivery(order, context) {
  const delivery = order.seat_delivery;
  if (order.channel !== 'IN_SEAT' || !delivery) return null;
  const schedule = context.scheduleById.get(delivery.schedule_id);
  const room = context.roomById.get(delivery.room_id);
  return {
    type: 'SEAT',
    seat: delivery.seat_code,
    room: room ? room.name : null,
    showtime: schedule ? { date: schedule.movie_date, time: schedule.time_begin } : null,
  };
}

// The KDS shape of an order. Deliberately price-free: the kitchen sees what to make and for whom, not
// what it cost, and there is no field here a client could echo back to change a price.
function presentOrder(order, context) {
  const status = toKdsStatus(order);
  const timestamps = kdsTimestamps(order);
  const account = order.account_id ? context.accountById.get(order.account_id) : null;
  const items = order.items.map((item) => ({
    combo_id: item.combo_id,
    name: item.name,
    quantity: item.quantity,
  }));
  return {
    id: order.id,
    code: order.code,
    branch_id: order.branch_id,
    status,
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    created_at: order.createdAt,
    status_changed_at: status ? timestamps[status] : null,
    timestamps,
    customer: account ? { id: account.id, name: account.name || null } : null,
    booking: presentBooking(order, context),
    channel: order.channel ?? null,
    delivery: presentDelivery(order, context),
    cancel_reason: order.cancel_reason ?? null,
    next_statuses: status ? KDS_TRANSITIONS[status] : [],
  };
}

async function presentOrders(orders) {
  const context = await loadContext(orders);
  return orders.map((order) => presentOrder(order, context));
}

async function present(order) {
  const [shaped] = await presentOrders([order]);
  return shaped;
}

// The board for one branch: every active order (NEW/PREPARING/READY) plus what finished recently.
async function getBoard(branchId, { statuses = null, recentMinutes, now = new Date() } = {}) {
  const wanted =
    statuses && statuses.length ? statuses : [...ACTIVE_KDS_STATUSES, ...DONE_KDS_STATUSES];
  const minutes = clampRecentMinutes(recentMinutes);
  const since = new Date(now.getTime() - minutes * 60 * 1000);
  const { data, truncated } = await comboOrderRepository.listForKitchen(
    branchId,
    buildClauses(wanted, since),
    {
      limit: MAX_BOARD_ORDERS,
    },
  );
  const orders = await presentOrders(data);
  const counts = Object.fromEntries(KDS_STATUSES.map((status) => [status, 0]));
  for (const order of orders) counts[order.status] += 1;
  return {
    branch_id: Number(branchId),
    server_time: now.toISOString(),
    recent_minutes: minutes,
    statuses: wanted,
    counts,
    truncated,
    orders,
  };
}

// The branches whose KDS the caller may open (`branchIds` null = every branch, for the Super Admin),
// each with how many orders are waiting in the kitchen right now. It is what the branch picker shows,
// so a viewer who is not tied to one branch lands on a kitchen that actually has work instead of the
// first branch in some unrelated order.
async function listBranches({ branchIds = null } = {}) {
  const filter = branchIds ? { id: { $in: branchIds.map(Number) } } : {};
  const branches = await Branch.find(filter, { id: 1, name: 1, status: 1 })
    .sort({ name: 1, id: 1 })
    .lean();
  const rows = await comboOrderRepository.countActiveForKitchen(branches.map((b) => b.id));
  const countsById = new Map(
    branches.map((b) => [
      b.id,
      Object.fromEntries(ACTIVE_KDS_STATUSES.map((status) => [status, 0])),
    ]),
  );
  for (const row of rows) {
    const counts = countsById.get(row.branch_id);
    if (counts) counts[ORDER_TO_KDS_STATUS[row.status]] += row.count;
  }
  return branches.map((branch) => {
    const counts = countsById.get(branch.id);
    return {
      id: branch.id,
      name: branch.name,
      status: branch.status,
      counts,
      active: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  });
}

module.exports = {
  DEFAULT_RECENT_MINUTES,
  MAX_RECENT_MINUTES,
  MAX_BOARD_ORDERS,
  clampRecentMinutes,
  buildClauses,
  getBoard,
  listBranches,
  present,
  presentOrders,
};
