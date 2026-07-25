const scheduleRepository = require('../repositories/schedule.repository');
const nextId = require('../utils/nextId');

// GET /api/schedule -> management list (admin or theater staff). Admin sees every showtime;
// a theater owner only sees showtimes in rooms that belong to their own cinema(s).
async function list(req, res) {
  if (req.account.role === 2) {
    const schedules = await scheduleRepository.findForOwner(req.account.accountId);
    return res.json(schedules);
  }

  const schedules = await scheduleRepository.findAll();
  res.json(schedules);
}

// GET /api/schedule/:id
async function getById(req, res) {
  const schedule = await scheduleRepository.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  res.json(schedule);
}

// POST /api/schedule { movie_id, room_id, movie_date, time_begin, time_end, price } (admin only —
// showtimes are scheduled centrally, not by individual cinema owners)
async function create(req, res) {
  const { movie_id, room_id, movie_date, time_begin, time_end, price } = req.body;
  if (!movie_id || !room_id || !movie_date || !time_begin || !time_end || price === undefined) {
    return res
      .status(400)
      .json({ message: 'movie_id, room_id, movie_date, time_begin, time_end and price are required' });
  }

  const id = await nextId('schedule');
  const schedule = await scheduleRepository.create({
    id,
    movie_id: Number(movie_id),
    room_id: Number(room_id),
    movie_date,
    time_begin,
    time_end,
    price: Number(price),
  });

  res.status(201).json(schedule);
}

module.exports = { list, getById, create };
