const signageRepository = require('../repositories/signage.repository');
const scheduleRepository = require('../repositories/schedule.repository');
const movieRepository = require('../repositories/movie.repository');
const promotionRepository = require('../repositories/promotion.repository');
const Screen = require('../models/Screen');
const SignageContent = require('../models/SignageContent');
const SignageSchedule = require('../models/SignageSchedule');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { resolvePlayback } = require('../services/signagePlayback');
const { generateScreenKey, hashScreenKey } = require('../utils/screenKey');

const SCREEN_STATUSES = Screen.STATUSES;
const CONTENT_TYPES = SignageContent.TYPES;
const CONTENT_STATUSES = SignageContent.STATUSES;
const ENTRY_STATUSES = SignageSchedule.STATUSES;

// ---- Screens ---------------------------------------------------------------

// GET /api/signage/screens?branchId=&status=&page=&limit= (signage.read, branch-scoped)
async function listScreens(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && SCREEN_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await signageRepository.findScreens(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/signage/screens/:id (signage.read, branch-scoped)
async function getScreen(req, res) {
  const screen = await signageRepository.findScreenById(req.params.id);
  if (!screen) return res.status(404).json({ message: 'Screen not found' });
  res.json(screen);
}

// POST /api/signage/screens { branch_id, name, location?, device_id?, status? } (signage.manage)
async function createScreen(req, res) {
  const branch_id = req.branchId;
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ message: 'name is required' });

  const device_id = req.body.device_id ? String(req.body.device_id).trim() : '';
  if (device_id && (await signageRepository.findScreenByDeviceId(device_id))) {
    return res.status(409).json({ message: 'A screen with this device_id already exists', code: 'SCREEN_DEVICE_ID_TAKEN' });
  }

  let status = 'ACTIVE';
  if (req.body.status !== undefined) {
    if (!SCREEN_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${SCREEN_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    status = req.body.status;
  }

  const apiKey = generateScreenKey();
  const id = await nextId('screen');
  const screen = await signageRepository.createScreen({
    id,
    branch_id,
    name,
    location: req.body.location ? String(req.body.location).trim() : '',
    device_id,
    status,
    api_key_hash: hashScreenKey(apiKey),
  });
  // The plaintext key is returned exactly once — it is never retrievable later.
  res.status(201).json({ ...screen.toJSON(), api_key: apiKey });
}

// POST /api/signage/screens/:id/rotate-key (signage.manage, branch-scoped) — invalidates the
// old key and returns a fresh one once. Use when a key is believed compromised.
async function rotateScreenKey(req, res) {
  const screen = await signageRepository.findScreenById(req.params.id);
  if (!screen) return res.status(404).json({ message: 'Screen not found' });

  const apiKey = generateScreenKey();
  await signageRepository.updateScreen(screen.id, { api_key_hash: hashScreenKey(apiKey) });
  res.json({ api_key: apiKey });
}

// PUT /api/signage/screens/:id { name?, location?, device_id?, status? } (signage.manage). The
// branch is immutable — re-register a screen elsewhere so its playlist history stays coherent.
async function updateScreen(req, res) {
  const screen = await signageRepository.findScreenById(req.params.id);
  if (!screen) return res.status(404).json({ message: 'Screen not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.location !== undefined) updates.location = String(req.body.location || '').trim();
  if (req.body.device_id !== undefined) {
    const device_id = String(req.body.device_id || '').trim();
    if (device_id) {
      const clash = await signageRepository.findScreenByDeviceId(device_id);
      if (clash && clash.id !== screen.id) {
        return res.status(409).json({ message: 'A screen with this device_id already exists', code: 'SCREEN_DEVICE_ID_TAKEN' });
      }
    }
    updates.device_id = device_id;
  }
  if (req.body.status !== undefined) {
    if (!SCREEN_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${SCREEN_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const updated = await signageRepository.updateScreen(screen.id, updates);
  res.json(updated);
}

// DELETE /api/signage/screens/:id (signage.manage) — refused while playlist entries still
// target it, which would otherwise leave dangling schedule rows.
async function removeScreen(req, res) {
  const screen = await signageRepository.findScreenById(req.params.id);
  if (!screen) return res.status(404).json({ message: 'Screen not found' });

  if ((await signageRepository.countSchedulesForScreen(screen.id)) > 0) {
    return res.status(409).json({ message: 'Remove this screen’s playlist entries first', code: 'SCREEN_HAS_SCHEDULES' });
  }

  await signageRepository.removeScreen(screen.id);
  res.json({ message: 'Deleted' });
}

// GET /api/signage/screens/:id/playback (signage.read, branch-scoped) — everything that should
// be on this screen right now, with the branch-isolation and cancelled-showtime rules applied.
// This is the admin preview; the media player itself uses GET /api/signage/playback instead.
async function getScreenPlayback(req, res) {
  const result = await resolvePlayback(req.params.id, { now: parseNow(req.query.at) });
  if (!result) return res.status(404).json({ message: 'Screen not found' });
  res.json(result);
}

// GET /api/signage/playback — the screen's own poll, authenticated by the X-Screen-Key header
// (requireScreen -> req.screen), NOT a user JWT. Returns exactly what getScreenPlayback would
// for that screen, so the same branch-isolation and cancelled-showtime rules apply.
async function getSelfPlayback(req, res) {
  const result = await resolvePlayback(req.screen.id, { now: new Date() });
  if (!result) return res.status(404).json({ message: 'Screen not found' });
  res.json(result);
}

function parseNow(raw) {
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// ---- Content -------------------------------------------------------------

// A SHOWTIME content item must point at a Schedule of its own branch that is not cancelled.
async function validateShowtimeRef(scheduleId, branchId) {
  if (scheduleId === undefined || scheduleId === null || scheduleId === '') {
    return { error: 'schedule_id is required for SHOWTIME content', code: 'SCHEDULE_ID_REQUIRED' };
  }
  const schedule = await scheduleRepository.findById(scheduleId);
  if (!schedule) return { error: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' };
  if (Number(schedule.cinema_id) !== Number(branchId)) {
    return { error: 'That showtime belongs to a different branch', code: 'SHOWTIME_BRANCH_MISMATCH' };
  }
  if (schedule.status === 'CANCELLED') {
    return { error: 'That showtime has been cancelled', code: 'SHOWTIME_CANCELLED' };
  }
  return { scheduleId: schedule.id };
}

// GET /api/signage/contents?branchId=&type=&status=&page=&limit= (signage.read, branch-scoped)
async function listContent(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.type && CONTENT_TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (req.query.status && CONTENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await signageRepository.findContent(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/signage/contents/:id (signage.read, branch-scoped)
async function getContent(req, res) {
  const content = await signageRepository.findContentById(req.params.id);
  if (!content) return res.status(404).json({ message: 'Content not found' });
  res.json(content);
}

// POST /api/signage/contents { branch_id, type, title, body?, image_url?, movie_id?,
// schedule_id?, promotion_id?, status? } (signage.manage, branch-scoped)
async function createContent(req, res) {
  const branch_id = req.branchId;
  const type = req.body.type;
  if (!CONTENT_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of ${CONTENT_TYPES.join(', ')}`, code: 'INVALID_TYPE' });
  }
  const title = req.body.title ? String(req.body.title).trim() : '';
  if (!title) return res.status(400).json({ message: 'title is required' });

  const doc = {
    branch_id,
    type,
    title,
    body: req.body.body ? String(req.body.body).trim() : '',
    image_url: req.body.image_url ? String(req.body.image_url).trim() : '',
    movie_id: null,
    schedule_id: null,
    promotion_id: null,
    status: 'ACTIVE',
  };

  if (req.body.status !== undefined) {
    if (!CONTENT_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${CONTENT_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    doc.status = req.body.status;
  }

  const refError = await applyContentRefs(doc, req.body, branch_id);
  if (refError) return res.status(400).json({ message: refError.error, code: refError.code });

  const id = await nextId('signageContent');
  const content = await signageRepository.createContent({ id, ...doc });
  res.status(201).json(content);
}

// PUT /api/signage/contents/:id (signage.manage, branch-scoped)
async function updateContent(req, res) {
  const content = await signageRepository.findContentById(req.params.id);
  if (!content) return res.status(404).json({ message: 'Content not found' });

  const updates = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ message: 'title cannot be empty' });
    updates.title = title;
  }
  if (req.body.body !== undefined) updates.body = String(req.body.body || '').trim();
  if (req.body.image_url !== undefined) updates.image_url = String(req.body.image_url || '').trim();
  if (req.body.status !== undefined) {
    if (!CONTENT_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${CONTENT_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const nextType = req.body.type !== undefined ? req.body.type : content.type;
  if (req.body.type !== undefined) {
    if (!CONTENT_TYPES.includes(req.body.type)) {
      return res.status(400).json({ message: `type must be one of ${CONTENT_TYPES.join(', ')}`, code: 'INVALID_TYPE' });
    }
    updates.type = req.body.type;
  }

  // Re-validate references whenever type or any ref field is touched.
  if (['type', 'movie_id', 'schedule_id', 'promotion_id'].some((k) => req.body[k] !== undefined)) {
    const merged = {
      type: nextType,
      movie_id: req.body.movie_id !== undefined ? req.body.movie_id : content.movie_id,
      schedule_id: req.body.schedule_id !== undefined ? req.body.schedule_id : content.schedule_id,
      promotion_id: req.body.promotion_id !== undefined ? req.body.promotion_id : content.promotion_id,
    };
    const doc = { type: nextType, movie_id: null, schedule_id: null, promotion_id: null };
    const refError = await applyContentRefs(doc, merged, content.branch_id);
    if (refError) return res.status(400).json({ message: refError.error, code: refError.code });
    updates.movie_id = doc.movie_id;
    updates.schedule_id = doc.schedule_id;
    updates.promotion_id = doc.promotion_id;
  }

  const updated = await signageRepository.updateContent(content.id, updates);
  res.json(updated);
}

// DELETE /api/signage/contents/:id (signage.manage, branch-scoped) — refused while a playlist
// entry still references it.
async function removeContent(req, res) {
  const content = await signageRepository.findContentById(req.params.id);
  if (!content) return res.status(404).json({ message: 'Content not found' });

  if ((await signageRepository.countSchedulesForContent(content.id)) > 0) {
    return res.status(409).json({ message: 'Remove the playlist entries that use this content first', code: 'CONTENT_HAS_SCHEDULES' });
  }

  await signageRepository.removeContent(content.id);
  res.json({ message: 'Deleted' });
}

// Validate and copy the type-appropriate reference field onto `doc`. Returns an error object or
// null. `source` carries the raw movie_id / schedule_id / promotion_id.
async function applyContentRefs(doc, source, branchId) {
  switch (doc.type) {
    case 'MOVIE_POSTER':
    case 'COMING_SOON': {
      if (source.movie_id === undefined || source.movie_id === null || source.movie_id === '') {
        return { error: 'movie_id is required for this content type', code: 'MOVIE_ID_REQUIRED' };
      }
      const movie = await movieRepository.findById(source.movie_id);
      if (!movie) return { error: 'Movie not found', code: 'MOVIE_NOT_FOUND' };
      doc.movie_id = movie.id;
      return null;
    }
    case 'SHOWTIME': {
      const check = await validateShowtimeRef(source.schedule_id, branchId);
      if (check.error) return check;
      doc.schedule_id = check.scheduleId;
      const schedule = await scheduleRepository.findById(check.scheduleId);
      if (schedule) doc.movie_id = schedule.movie_id;
      return null;
    }
    case 'PROMOTION': {
      if (source.promotion_id === undefined || source.promotion_id === null || source.promotion_id === '') {
        return { error: 'promotion_id is required for PROMOTION content', code: 'PROMOTION_ID_REQUIRED' };
      }
      const promotion = await promotionRepository.findById(source.promotion_id);
      if (!promotion) return { error: 'Promotion not found', code: 'PROMOTION_NOT_FOUND' };
      doc.promotion_id = promotion.id;
      return null;
    }
    default:
      // ADVERTISEMENT / ANNOUNCEMENT — free-form, no reference required.
      return null;
  }
}

// ---- Schedules (playlist entries) --------------------------------------------

// GET /api/signage/schedules?screenId=&contentId=&status=&page=&limit= (signage.read). A
// BRANCH-scoped caller must pass a screenId they can access (see the route's resolver).
async function listSchedules(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.screenId) filter.screen_id = Number(req.query.screenId);
  if (req.query.contentId) filter.content_id = Number(req.query.contentId);
  if (req.query.status && ENTRY_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await signageRepository.findSchedules(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/signage/schedules/:id (signage.read, branch-scoped by the entry's screen)
async function getSchedule(req, res) {
  const entry = await signageRepository.findScheduleById(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Playlist entry not found' });
  res.json(entry);
}

function parseWindow(body) {
  const start = new Date(body.start_at);
  const end = new Date(body.end_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'start_at and end_at must be valid dates', code: 'INVALID_WINDOW' };
  }
  if (start >= end) return { error: 'start_at must be before end_at', code: 'INVALID_WINDOW' };
  return { start, end };
}

// POST /api/signage/schedules { content_id, screen_id, start_at, end_at, priority?, status? }
// (signage.manage). The route has already confirmed the caller can access screen_id's branch;
// here we enforce that the content lives in that same branch.
async function createSchedule(req, res) {
  const content_id = Number(req.body.content_id);
  const screen_id = Number(req.body.screen_id);
  if (!content_id || !screen_id) {
    return res.status(400).json({ message: 'content_id and screen_id are required' });
  }

  const [content, screen] = await Promise.all([
    signageRepository.findContentById(content_id),
    signageRepository.findScreenById(screen_id),
  ]);
  if (!screen) return res.status(404).json({ message: 'Screen not found' });
  if (!content) return res.status(404).json({ message: 'Content not found' });
  if (Number(content.branch_id) !== Number(screen.branch_id)) {
    return res.status(400).json({ message: 'The content and the screen belong to different branches', code: 'SIGNAGE_BRANCH_MISMATCH' });
  }

  const window = parseWindow(req.body);
  if (window.error) return res.status(400).json({ message: window.error, code: window.code });

  let status = 'ACTIVE';
  if (req.body.status !== undefined) {
    if (!ENTRY_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${ENTRY_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    status = req.body.status;
  }

  const id = await nextId('signageSchedule');
  const entry = await signageRepository.createSchedule({
    id,
    content_id,
    screen_id,
    start_at: window.start,
    end_at: window.end,
    priority: Number.isFinite(Number(req.body.priority)) ? Number(req.body.priority) : 0,
    status,
  });
  res.status(201).json(entry);
}

// PUT /api/signage/schedules/:id { start_at?, end_at?, priority?, status? } (signage.manage).
// content_id and screen_id are immutable so the entry can never be re-pointed across branches.
async function updateSchedule(req, res) {
  const entry = await signageRepository.findScheduleById(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Playlist entry not found' });

  const updates = {};
  if (req.body.start_at !== undefined || req.body.end_at !== undefined) {
    const window = parseWindow({
      start_at: req.body.start_at !== undefined ? req.body.start_at : entry.start_at,
      end_at: req.body.end_at !== undefined ? req.body.end_at : entry.end_at,
    });
    if (window.error) return res.status(400).json({ message: window.error, code: window.code });
    updates.start_at = window.start;
    updates.end_at = window.end;
  }
  if (req.body.priority !== undefined) {
    if (!Number.isFinite(Number(req.body.priority))) {
      return res.status(400).json({ message: 'priority must be a number', code: 'INVALID_PRIORITY' });
    }
    updates.priority = Number(req.body.priority);
  }
  if (req.body.status !== undefined) {
    if (!ENTRY_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${ENTRY_STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const updated = await signageRepository.updateSchedule(entry.id, updates);
  res.json(updated);
}

// DELETE /api/signage/schedules/:id (signage.manage, branch-scoped by the entry's screen)
async function removeSchedule(req, res) {
  const entry = await signageRepository.findScheduleById(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Playlist entry not found' });
  await signageRepository.removeSchedule(entry.id);
  res.json({ message: 'Deleted' });
}

module.exports = {
  listScreens,
  getScreen,
  createScreen,
  updateScreen,
  removeScreen,
  rotateScreenKey,
  getScreenPlayback,
  getSelfPlayback,
  listContent,
  getContent,
  createContent,
  updateContent,
  removeContent,
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  removeSchedule,
};
