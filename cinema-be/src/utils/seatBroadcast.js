const { emitToSchedule } = require('./socket');
const { REALTIME_EVENT } = require('./realtimeEvents');

// Pushes the live seat map to everyone currently looking at a showtime (customer web, kiosk and box
// office alike). The payload deliberately carries no identity — only seat codes and their new status
// — so the `schedule:<id>` room is safe for anonymous sockets; a client that needs to know whether a
// hold is its own refetches the grid, where the server still computes `held_by_me`.
function broadcastSeatUpdate(tickets, status) {
  const seatCodesBySchedule = new Map();
  for (const ticket of tickets || []) {
    if (!ticket || !ticket.schedule_id) continue;
    if (!seatCodesBySchedule.has(ticket.schedule_id)) seatCodesBySchedule.set(ticket.schedule_id, []);
    seatCodesBySchedule.get(ticket.schedule_id).push(ticket.seat_code);
  }
  for (const [scheduleId, seatCodes] of seatCodesBySchedule) {
    emitToSchedule(scheduleId, REALTIME_EVENT.SEAT_UPDATED, { scheduleId, seatCodes, status });
  }
}

module.exports = { broadcastSeatUpdate };
