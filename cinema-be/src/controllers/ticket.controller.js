const ticketRepository = require('../repositories/ticket.repository');
const nextId = require('../utils/nextId');

// POST /api/ticket { schedule_id } -> generates the seat grid for a schedule from the room's seat map
// (admin only, since schedules are now admin-managed). DISABLED seats are excluded from
// the bookable grid.
async function create(req, res) {
  const { schedule_id } = req.body;
  if (!schedule_id) return res.status(400).json({ message: 'schedule_id is required' });

  const existing = await ticketRepository.countByScheduleId(schedule_id);
  if (existing > 0) {
    const tickets = await ticketRepository.findByScheduleId(schedule_id);
    return res.status(200).json(tickets);
  }

  const schedule = await ticketRepository.findScheduleById(schedule_id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  if (schedule.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has been cancelled', code: 'SCHEDULE_CANCELLED' });
  }

  const seatMap = await ticketRepository.findSeatMapByRoomId(schedule.room_id);
  if (seatMap.length === 0) {
    return res.status(400).json({ message: 'Room has no seat map. Set up seats for this room first.' });
  }

  const tickets = [];
  let seatIndex = 0;
  for (const seat of seatMap) {
    if (seat.status === 'DISABLED') continue;
    const id = await nextId('ticket');
    tickets.push({
      id,
      schedule_id: Number(schedule_id),
      seat_index: seatIndex,
      seat_code: seat.seat_code,
      seat_type: seat.seat_type,
      status: 1,
    });
    seatIndex += 1;
  }

  const created = await ticketRepository.insertMany(tickets);
  res.status(201).json(created);
}

// PUT /api/ticket/:id -> mark a ticket as booked/sold (auth required)
async function markSold(req, res) {
  const ticket = await ticketRepository.markSold(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
  res.json(ticket);
}

module.exports = { create, markSold };
