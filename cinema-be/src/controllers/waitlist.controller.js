const waitlistService = require('../services/waitlist.service');
const Waitlist = require('../models/Waitlist');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const { WaitlistError } = waitlistService;

function withWaitlistErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof WaitlistError)) throw err;
      res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
    }
  };
}

// Every route serves the caller's own entries only — the account always comes from the token.
const accountOf = (req) => req.account.accountId;

// GET /api/waitlist?status=WAITING,NOTIFIED&page&limit
async function listMine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const statuses = String(req.query.status || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => Object.values(Waitlist.STATUS).includes(s));
  const { data, total } = await waitlistService.listMine({ accountId: accountOf(req), statuses, skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/waitlist/showtimes/:scheduleId -> is it full, how long is the queue, where am I in it
async function showtimeStatus(req, res) {
  res.json(await waitlistService.getShowtimeStatus({ scheduleId: req.params.scheduleId, accountId: accountOf(req) }));
}

// POST /api/waitlist { schedule_id, seat_count }
async function join(req, res) {
  res.status(201).json(await waitlistService.join({ accountId: accountOf(req), body: req.body }));
}

// GET /api/waitlist/:id
async function getMine(req, res) {
  res.json(await waitlistService.getMine({ id: req.params.id, accountId: accountOf(req) }));
}

// POST /api/waitlist/:id/cancel -> leave the queue, or decline an offer
async function cancelMine(req, res) {
  res.json(await waitlistService.cancelMine({ id: req.params.id, accountId: accountOf(req) }));
}

module.exports = {
  listMine: withWaitlistErrors(listMine),
  showtimeStatus: withWaitlistErrors(showtimeStatus),
  join: withWaitlistErrors(join),
  getMine: withWaitlistErrors(getMine),
  cancelMine: withWaitlistErrors(cancelMine),
};
